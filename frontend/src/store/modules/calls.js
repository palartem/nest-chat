async function getMediaWithFallback () {
    const primary = {
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true
    }
    try {
        return await navigator.mediaDevices.getUserMedia(primary)
    } catch (err) {
        console.warn('[getUserMedia] primary failed:', err?.name, err?.message)
        return await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    }
}

function isLocalNetworkHost (host) {
    if (!host) return false
    if (host === 'localhost') return true
    if (host.startsWith('127.')) return true
    const m = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/)
    if (!m) return false
    const a = m.slice(1).map(n => parseInt(n, 10))
    if (a[0] === 10) return true
    if (a[0] === 172 && a[1] >= 16 && a[1] <= 31) return true
    if (a[0] === 192 && a[1] === 168) return true
    return false
}

function rtcConfig () {
    const urls = (import.meta.env.VITE_TURN_URLS || '')
        .split(',').map(s => s.trim()).filter(Boolean)
    const username = import.meta.env.VITE_TURN_USERNAME
    const credential = import.meta.env.VITE_TURN_CREDENTIAL
    const forceTurn = String(import.meta.env.VITE_FORCE_TURN || '').trim() === '1'

    if (forceTurn) {
        const turnTcp = urls.filter(u => /turns:.*5349\?transport=tcp/i.test(u))
        console.log('[RTC] force TURN TCP only:', turnTcp)
        return {
            iceServers: turnTcp.length ? [{ urls: turnTcp, username, credential }] : [],
            iceTransportPolicy: 'relay'
        }
    }

    // обычный режим
    return {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            ...(urls && username && credential ? [{ urls, username, credential }] : [])
        ]
    }
}

function logError (scope, err) {
    console.error(`[${scope}]`, err?.name || err, err?.message || '')
}

function attachPcHandlers (peerConnection, { socket, toUserId, chatId, commit }) {
    const remoteStream = new MediaStream()

    peerConnection.ontrack = (event) => {
        console.log('[CALL] Remote track:', event.track?.kind, event.track?.id)
        const already = remoteStream.getTracks().some(t => t.id === event.track?.id)
        if (!already && event.track) {
            remoteStream.addTrack(event.track)
        }
        commit('SET_REMOTE_STREAM', remoteStream)
    }

    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            console.log('[CALL] Local ICE candidate:', event.candidate.candidate)
            socket.emit('callIce', { toUserId, chatId, candidate: event.candidate })
        } else {
            console.log('[CALL] All local ICE candidates sent')
        }
    }

    peerConnection.oniceconnectionstatechange = () => {
        console.log('[CALL] ICE state:', peerConnection.iceConnectionState)
    }
    peerConnection.onconnectionstatechange = () => {
        console.log('[CALL] Conn state:', peerConnection.connectionState)
    }
    peerConnection.onicecandidateerror = (e) => {
        console.warn('[CALL] ICE candidate error:', e)
    }

    return peerConnection
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
        SET_CALL_STATE (state, payload) { Object.assign(state, payload) },
        SET_LOCAL_STREAM (state, stream) { state.localStream = stream },
        SET_REMOTE_STREAM (state, stream) { state.remoteStream = stream },
        SET_INCOMING (state, payload) { state.incoming = payload }
    },

    actions: {
        incomingInvite ({ commit }, { fromUserId, chatId, sdp }) {
            commit('SET_INCOMING', { fromUserId, chatId, sdp })
        },

        declineIncoming ({ commit, rootState, state }) {
            const socket = rootState.chat.socket
            if (socket && state.incoming?.fromUserId && state.incoming?.chatId) {
                socket.emit('callEnd', { toUserId: state.incoming.fromUserId, chatId: state.incoming.chatId })
            }
            commit('SET_INCOMING', null)
        },

        async acceptIncoming ({ commit, dispatch }, { fromUserId, chatId, sdp }) {
            commit('SET_INCOMING', null)
            await dispatch('receiveCall', { fromUserId, chatId, sdp })
        },

        async startCall ({ commit, rootState, state }, { chatId, toUserId }) {
            const socket = rootState.chat.socket
            if (!socket) return

            try { state.localStream?.getTracks().forEach(t => t.stop()) } catch (err) { console.warn('stop localStream error', err) }
            try { state.remoteStream?.getTracks().forEach(t => t.stop()) } catch (err) { console.warn('stop remoteStream error', err) }
            try { state.peerConnection?.close() } catch (err) { console.warn('close peerConnection error', err) }

            commit('SET_CALL_STATE', {
                active: true, chatId, toUserId, isCaller: true,
                peerConnection: null, localStream: null, remoteStream: null
            })

            try {
                const localStream = await getMediaWithFallback()
                commit('SET_LOCAL_STREAM', localStream)

                const peerConnection = attachPcHandlers(
                    new RTCPeerConnection(rtcConfig()),
                    { socket, toUserId, chatId, commit }
                )

                localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream))
                commit('SET_CALL_STATE', { peerConnection })

                const offer = await peerConnection.createOffer()
                await peerConnection.setLocalDescription(offer)

                socket.emit('callInvite', { toUserId, chatId, sdp: offer })
            } catch (err) {
                logError('startCall', err)
                this.dispatch('calls/endCallSilent', null, { root: true })
            }
        },

        async receiveCall ({ commit, rootState, state }, { fromUserId, chatId, sdp }) {
            const socket = rootState.chat.socket
            if (!socket) return

            try { state.localStream?.getTracks().forEach(t => t.stop()) } catch (err) { console.warn('stop localStream error', err) }
            try { state.remoteStream?.getTracks().forEach(t => t.stop()) } catch (err) { console.warn('stop remoteStream error', err) }
            try { state.peerConnection?.close() } catch (err) { console.warn('close peerConnection error', err) }

            commit('SET_CALL_STATE', {
                active: true, chatId, toUserId: fromUserId, isCaller: false,
                peerConnection: null, localStream: null, remoteStream: null
            })

            try {
                const localStream = await getMediaWithFallback()
                commit('SET_LOCAL_STREAM', localStream)

                const peerConnection = attachPcHandlers(
                    new RTCPeerConnection(rtcConfig()),
                    { socket, toUserId: fromUserId, chatId, commit }
                )

                localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream))
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
                if (!state.peerConnection) return
                await state.peerConnection.setRemoteDescription(new RTCSessionDescription(sdp))
            } catch (err) {
                logError('handleCallAnswer', err)
            }
        },

        async handleIceCandidate ({ state }, { candidate }) {
            try {
                if (state.peerConnection && candidate) {
                    console.log('[CALL] Remote ICE candidate received:', candidate?.candidate)
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

            try { state.localStream?.getTracks().forEach(track => track.stop()) } catch (err) { console.warn('stop localStream error', err) }
            try { state.remoteStream?.getTracks().forEach(track => track.stop()) } catch (err) { console.warn('stop remoteStream error', err) }
            try { state.peerConnection?.close() } catch (err) { console.warn('close peerConnection error', err) }

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
            try { state.localStream?.getTracks().forEach(track => track.stop()) } catch (err) { console.warn('stop localStream error', err) }
            try { state.remoteStream?.getTracks().forEach(track => track.stop()) } catch (err) { console.warn('stop remoteStream error', err) }
            try { state.peerConnection?.close() } catch (err) { console.warn('close peerConnection error', err) }

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
