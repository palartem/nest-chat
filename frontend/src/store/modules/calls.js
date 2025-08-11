async function getMediaWithFallback () {
    const primary = {
        video: {
            facingMode: 'user',
            width: { ideal: 1280 },
            height: { ideal: 720 }
        },
        audio: true
    };

    try {
        return await navigator.mediaDevices.getUserMedia(primary);
    } catch (err) {
        console.warn('[getUserMedia] primary failed:', err?.name, err?.message);
        // запасной вариант попроще
        return await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    }
}

function rtcConfig () {
    // базовый STUN; при деплое добавь свой TURN
    return {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
        ]
    };
}

function logError (scope, err) {
    console.error(`[${scope}]`, err?.name || err, err?.message || '');
}

// --- module ----------------------------------------------------------------

export default {
    namespaced: true,

    state: () => ({
        active: false,
        chatId: null,
        peerConnection: null,
        localStream: null,
        remoteStream: null,
        toUserId: null,
        isCaller: false
    }),

    getters: {
        callActive: (state) => state.active,
        localStream: (state) => state.localStream,
        remoteStream: (state) => state.remoteStream
    },

    mutations: {
        SET_CALL_STATE (state, payload) {
            Object.assign(state, payload);
        },
        SET_LOCAL_STREAM (state, stream) {
            state.localStream = stream;
        },
        SET_REMOTE_STREAM (state, stream) {
            state.remoteStream = stream;
        }
    },

    actions: {
        async startCall ({ commit, rootState }, { chatId, toUserId }) {
            const socket = rootState.chat.socket;
            if (!socket) return;

            commit('SET_CALL_STATE', { active: true, chatId, toUserId, isCaller: true });

            try {
                const localStream = await getMediaWithFallback();
                commit('SET_LOCAL_STREAM', localStream);

                const peerConnection = new RTCPeerConnection(rtcConfig());
                localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

                const remoteStream = new MediaStream();
                peerConnection.ontrack = (event) => {
                    event.streams[0].getTracks().forEach(track => remoteStream.addTrack(track));
                    commit('SET_REMOTE_STREAM', remoteStream);
                };

                peerConnection.onicecandidate = (event) => {
                    if (event.candidate) {
                        socket.emit('callIce', { toUserId, chatId, candidate: event.candidate });
                    }
                };

                commit('SET_CALL_STATE', { peerConnection });

                const offer = await peerConnection.createOffer();
                await peerConnection.setLocalDescription(offer);

                socket.emit('callInvite', { toUserId, chatId, sdp: offer });
            } catch (err) {
                logError('startCall', err);
                // откатить состояние, если не взлетело
                this.dispatch('calls/endCallSilent', null, { root: true });
            }
        },

        // Пришёл инвайт на звонок
        async receiveCall ({ commit, rootState }, { fromUserId, chatId, sdp }) {
            const socket = rootState.chat.socket;
            if (!socket) return;

            commit('SET_CALL_STATE', { active: true, chatId, toUserId: fromUserId, isCaller: false });

            try {
                const localStream = await getMediaWithFallback();
                commit('SET_LOCAL_STREAM', localStream);

                const peerConnection = new RTCPeerConnection(rtcConfig());
                localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

                const remoteStream = new MediaStream();
                peerConnection.ontrack = (event) => {
                    event.streams[0].getTracks().forEach(track => remoteStream.addTrack(track));
                    commit('SET_REMOTE_STREAM', remoteStream);
                };

                peerConnection.onicecandidate = (event) => {
                    if (event.candidate) {
                        socket.emit('callIce', { toUserId: fromUserId, chatId, candidate: event.candidate });
                    }
                };

                commit('SET_CALL_STATE', { peerConnection });

                await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
                const answer = await peerConnection.createAnswer();
                await peerConnection.setLocalDescription(answer);

                socket.emit('callAnswer', { toUserId: fromUserId, chatId, sdp: answer });
            } catch (err) {
                logError('receiveCall', err);
                this.dispatch('calls/endCallSilent', null, { root: true });
            }
        },

        // Наш оффер приняли — пришёл ответ
        async handleCallAnswer ({ state }, { sdp }) {
            try {
                await state.peerConnection?.setRemoteDescription(new RTCSessionDescription(sdp));
            } catch (err) {
                logError('handleCallAnswer', err);
            }
        },

        // Лёд-кандидаты
        async handleIceCandidate ({ state }, { candidate }) {
            try {
                if (state.peerConnection && candidate) {
                    await state.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
                }
            } catch (err) {
                logError('handleIceCandidate', err);
            }
        },

        // Завершение
        endCall ({ commit, state, rootState }) {
            const socket = rootState.chat.socket;
            if (socket && state.toUserId && state.chatId) {
                socket.emit('callEnd', { toUserId: state.toUserId, chatId: state.chatId });
            }

            try {
                state.localStream?.getTracks().forEach(track => track.stop());
                state.remoteStream?.getTracks().forEach(track => track.stop());
                state.peerConnection?.close();
            } catch (err) {
                logError('endCall', err);
            }

            commit('SET_CALL_STATE', {
                active: false,
                chatId: null,
                peerConnection: null,
                localStream: null,
                remoteStream: null,
                toUserId: null,
                isCaller: false
            });
        },

        // Удалённое завершение — закрываем локально
        endCallSilent ({ commit, state }) {
            try {
                state.localStream?.getTracks().forEach(track => track.stop());
                state.remoteStream?.getTracks().forEach(track => track.stop());
                state.peerConnection?.close();
            } catch (err) {
                logError('endCallSilent', err);
            }

            commit('SET_CALL_STATE', {
                active: false,
                chatId: null,
                peerConnection: null,
                localStream: null,
                remoteStream: null,
                toUserId: null,
                isCaller: false
            });
        }
    }
};
