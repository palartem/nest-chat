async function getMediaWithFallback () {
    const primary = {
        video: {
            facingMode: 'user',
            width: { ideal: 1280 },
            height: { ideal: 720 }
        },
        audio: true
    }

    try {
        return await navigator.mediaDevices.getUserMedia(primary)
    } catch (err) {
        console.warn('[getUserMedia] primary failed:', err?.name, err?.message)
        return await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    }
}

function rtcConfig () {
    const urls = (import.meta.env.VITE_TURN_URLS || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)

    const username = import.meta.env.VITE_TURN_USERNAME
    const credential = import.meta.env.VITE_TURN_CREDENTIAL

    const iceServers = [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]

    if (urls.length && username && credential) {
        iceServers.push({ urls, username, credential })
    }

    return { iceServers }
}

const pc = new RTCPeerConnection({
    ...rtcConfig(),
    ...(import.meta.env.VITE_FORCE_TURN ? { iceTransportPolicy: 'relay' } : {})
})
pc.oniceconnectionstatechange = () => console.log('ICE:', pc.iceConnectionState)
pc.onicecandidateerror = (e) => console.warn('ICE error:', e)

function logError (scope, err) {
    console.error(`[${scope}]`, err?.name || err, err?.message || '')
}

export default {
    namespaced: true,

    state: () => ({
        active: false,
        chatId: null,
        peerConnection: null,
        localStream: null,
        remoteStream: null,
        toUserId: null,
        isCaller: false,
        incoming: null
    }),

    getters: {
        callActive: (state) => state.active,
        localStream: (state) => state.localStream,
        remoteStream: (state) => state.remoteStream,
        incomingCall: (state) => state.incoming
    },

    mutations: {
        SET_CALL_STATE (state, payload) {
            Object.assign(state, payload)
        },
        SET_LOCAL_STREAM (state, stream) {
            state.localStream = stream
        },
        SET_REMOTE_STREAM (state, stream) {
            state.remoteStream = stream
        },
        SET_INCOMING (state, payload) {
            state.incoming = payload
        }
    },

    actions: {
        // прилетел инвайт
        incomingInvite ({ commit }, { fromUserId, chatId, sdp }) {
            commit('SET_INCOMING', { fromUserId, chatId, sdp })
        },

        // пользователь нажал "Отклонить"
        declineIncoming ({ commit, rootState, state }) {
            const socket = rootState.chat.socket
            if (socket && state.incoming?.fromUserId && state.incoming?.chatId) {
                socket.emit('callEnd', {
                    toUserId: state.incoming.fromUserId,
                    chatId: state.incoming.chatId
                })
            }
            commit('SET_INCOMING', null)
        },

        // пользователь нажал "Принять"
        async acceptIncoming ({ commit, dispatch }, { fromUserId, chatId, sdp }) {
            commit('SET_INCOMING', null)
            await dispatch('receiveCall', { fromUserId, chatId, sdp })
        },

        async startCall ({ commit, rootState, state }, { chatId, toUserId }) {
            const socket = rootState.chat.socket
            if (!socket) return

            // читска вызова
            try {
                state.localStream?.getTracks().forEach(t => t.stop())
            } catch (err) {
                console.log(err);
            }
            try {
                state.remoteStream?.getTracks().forEach(t => t.stop())
            } catch (err) {
                console.log(err);
            }
            try {
                state.peerConnection?.close()
            } catch (err) {
                console.log(err);
            }

            commit('SET_CALL_STATE', {
                active: true, chatId, toUserId, isCaller: true,
                peerConnection: null, localStream: null, remoteStream: null
            })

            try {
                const localStream = await getMediaWithFallback()
                commit('SET_LOCAL_STREAM', localStream)

                const peerConnection = new RTCPeerConnection(rtcConfig())
                localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream))

                const remoteStream = new MediaStream()
                peerConnection.ontrack = (event) => {
                    event.streams[0].getTracks().forEach(track => remoteStream.addTrack(track))
                    commit('SET_REMOTE_STREAM', remoteStream)
                }

                peerConnection.onicecandidate = (event) => {
                    if (event.candidate) {
                        socket.emit('callIce', { toUserId, chatId, candidate: event.candidate })
                    }
                }

                commit('SET_CALL_STATE', { peerConnection })

                const offer = await peerConnection.createOffer()
                await peerConnection.setLocalDescription(offer)

                socket.emit('callInvite', { toUserId, chatId, sdp: offer })
            } catch (err) {
                // камера занята / блокировка разрешений / и пр.
                logError('startCall', err)
                this.dispatch('calls/endCallSilent', null, { root: true })
            }
        },

        // принять звонок (используется из acceptIncoming)
        async receiveCall ({ commit, rootState, state }, { fromUserId, chatId, sdp }) {
            const socket = rootState.chat.socket
            if (!socket) return

            // почистим предыдущие
            try {
                state.localStream?.getTracks().forEach(t => t.stop())
            } catch (err) {
                console.log(err);
            }
            try {
                state.remoteStream?.getTracks().forEach(t => t.stop())
            } catch (err) {
                console.log(err);
            }
            try {
                state.peerConnection?.close()
            } catch (err) {
                console.log(err);
            }

            commit('SET_CALL_STATE', {
                active: true, chatId, toUserId: fromUserId, isCaller: false,
                peerConnection: null, localStream: null, remoteStream: null
            })

            try {
                const localStream = await getMediaWithFallback()
                commit('SET_LOCAL_STREAM', localStream)

                const peerConnection = new RTCPeerConnection(rtcConfig())
                localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream))

                const remoteStream = new MediaStream()
                peerConnection.ontrack = (event) => {
                    event.streams[0].getTracks().forEach(track => remoteStream.addTrack(track))
                    commit('SET_REMOTE_STREAM', remoteStream)
                }

                peerConnection.onicecandidate = (event) => {
                    if (event.candidate) {
                        socket.emit('callIce', { toUserId: fromUserId, chatId, candidate: event.candidate })
                    }
                }

                commit('SET_CALL_STATE', { peerConnection })

                await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp))
                const answer = await peerConnection.createAnswer()
                await peerConnection.setLocalDescription(answer)

                socket.emit('callAnswer', { toUserId: fromUserId, chatId, sdp: answer })
            } catch (err) {
                logError('receiveCall', err)
                this.dispatch('calls/endCallSilent', null, { root: true })
            }
        },

        async handleCallAnswer ({ state }, { sdp }) {
            try {
                // устанавливаем answer только если у нас есть peerConnection и мы в состоянии ожидания ответа
                if (!state.peerConnection) return
                await state.peerConnection.setRemoteDescription(new RTCSessionDescription(sdp))
            } catch (err) {
                logError('handleCallAnswer', err)
            }
        },

        async handleIceCandidate ({ state }, { candidate }) {
            try {
                if (state.peerConnection && candidate) {
                    await state.peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
                }
            } catch (err) {
                logError('handleIceCandidate', err)
            }
        },

        endCall ({ commit, state, rootState }) {
            const socket = rootState.chat.socket
            if (socket && state.toUserId && state.chatId) {
                socket.emit('callEnd', { toUserId: state.toUserId, chatId: state.chatId })
            }

            try {
                state.localStream?.getTracks().forEach(track => track.stop())
                state.remoteStream?.getTracks().forEach(track => track.stop())
                state.peerConnection?.close()
            } catch (err) {
                logError('endCall', err)
            }

            commit('SET_CALL_STATE', {
                active: false,
                chatId: null,
                peerConnection: null,
                localStream: null,
                remoteStream: null,
                toUserId: null,
                isCaller: false
            })
        },

        endCallSilent ({ commit, state }) {
            try {
                state.localStream?.getTracks().forEach(track => track.stop())
                state.remoteStream?.getTracks().forEach(track => track.stop())
                state.peerConnection?.close()
            } catch (err) {
                logError('endCallSilent', err)
            }

            commit('SET_CALL_STATE', {
                active: false,
                chatId: null,
                peerConnection: null,
                localStream: null,
                remoteStream: null,
                toUserId: null,
                isCaller: false
            })
        }
    }
}
