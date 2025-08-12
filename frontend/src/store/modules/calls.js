console.log('[CALLS BUILD] v-tcp-only-04')

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

const isForceTurn = () => String(import.meta.env.VITE_FORCE_TURN || '').trim() === '1'

function warn (scope, err) {
    console.warn(`[CALL] ${scope}:`, err?.name || err, err?.message || err)
}
function stopTracks (stream, label) {
    if (!stream) return
    try { stream.getTracks().forEach(t => t.stop()) } catch (err) { warn(`stop ${label}`, err) }
}
function closePc (pc) {
    if (!pc) return
    try { pc.close() } catch (err) { warn('close peerConnection', err) }
}

function rtcConfig () {
    const urls = (import.meta.env.VITE_TURN_URLS || '').split(',').map(s => s.trim()).filter(Boolean)
    const username = import.meta.env.VITE_TURN_USERNAME
    const credential = import.meta.env.VITE_TURN_CREDENTIAL
    const disableTurnLocal = String(import.meta.env.VITE_DISABLE_TURN_LOCAL || '') === '1'
    const isLocal = isLocalNetworkHost(window.location.hostname)

    if (isForceTurn()) {
        const tcpOnly = urls.filter(u => /transport=tcp/i.test(u) || /^turns:/i.test(u))
        const iceServers = tcpOnly.map(u => ({ urls: u, username, credential }))
        return { iceServers, iceTransportPolicy: 'relay' }
    }

    const iceServers = [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
    if (!(disableTurnLocal && isLocal) && urls.length && username && credential) {
        urls.forEach(u => iceServers.push({ urls: u, username, credential }))
    }
    return { iceServers }
}

function logError (scope, err) {
    console.error(`[${scope}]`, err?.name || err, err?.message || '')
}

function attachPcHandlers (pc, { socket, toUserId, chatId, commit }) {
    pc.ontrack = (e) => {
        const stream = e.streams?.[0]
        if (stream) {
            console.log('[CALL] Remote track:', e.track?.kind, e.track?.id)
            commit('SET_REMOTE_STREAM', stream)
        }
    }
    pc.onicecandidate = (event) => {
        if (!event.candidate) { console.log('[CALL] All local ICE candidates sent'); return }
        const s = event.candidate.candidate || ''
        console.log('[CALL] Local ICE candidate:', s)
        socket.emit('callIce', { toUserId, chatId, candidate: event.candidate })
    }
    pc.onicegatheringstatechange = () => { console.log('[CALL] ICE gathering state:', pc.iceGatheringState) }
    pc.oniceconnectionstatechange = () => { console.log('[CALL] ICE state:', pc.iceConnectionState) }
    pc.onconnectionstatechange = () => { console.log('[CALL] Conn state:', pc.connectionState) }
    pc.onicecandidateerror = (e) => {
        console.warn('[CALL] ICE candidate error:', { url: e.url, hostCandidate: e.hostCandidate, errorCode: e.errorCode, errorText: e.errorText })
    }
    return pc
}

async function getMediaWithFallback () {
    const primary = { video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: true }
    try { return await navigator.mediaDevices.getUserMedia(primary) }
    catch (err) {
        console.warn('[getUserMedia] primary failed:', err?.name, err?.message)
        return await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    }
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
        callActive: (s) => s.active,
        localStream: (s) => s.localStream,
        remoteStream: (s) => s.remoteStream,
        incomingCall: (s) => s.incoming
    },

    mutations: {
        SET_CALL_STATE (s, payload) { Object.assign(s, payload) },
        SET_LOCAL_STREAM (s, stream) { s.localStream = stream },
        SET_REMOTE_STREAM (s, stream) { s.remoteStream = stream },
        SET_INCOMING (s, payload) { s.incoming = payload }
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
            stopTracks(state.localStream, 'localStream')
            stopTracks(state.remoteStream, 'remoteStream')
            closePc(state.peerConnection)
            commit('SET_CALL_STATE', {
                active: true, chatId, toUserId, isCaller: true,
                peerConnection: null, localStream: null, remoteStream: null
            })
            try {
                const localStream = await getMediaWithFallback()
                commit('SET_LOCAL_STREAM', localStream)
                const pc = new RTCPeerConnection(rtcConfig())
                localStream.getTracks().forEach(tr => pc.addTrack(tr, localStream))
                attachPcHandlers(pc, { socket, toUserId, chatId, commit })
                commit('SET_CALL_STATE', { peerConnection: pc })
                const offer = await pc.createOffer()
                await pc.setLocalDescription(offer)
                socket.emit('callInvite', { toUserId, chatId, sdp: offer })
            } catch (err) {
                logError('startCall', err)
                this.dispatch('calls/endCallSilent', null, { root: true })
            }
        },

        async receiveCall ({ commit, rootState, state }, { fromUserId, chatId, sdp }) {
            const socket = rootState.chat.socket
            if (!socket) return
            stopTracks(state.localStream, 'localStream')
            stopTracks(state.remoteStream, 'remoteStream')
            closePc(state.peerConnection)
            commit('SET_CALL_STATE', {
                active: true, chatId, toUserId: fromUserId, isCaller: false,
                peerConnection: null, localStream: null, remoteStream: null
            })
            try {
                const localStream = await getMediaWithFallback()
                commit('SET_LOCAL_STREAM', localStream)
                const pc = new RTCPeerConnection(rtcConfig())
                localStream.getTracks().forEach(tr => pc.addTrack(tr, localStream))
                attachPcHandlers(pc, { socket, toUserId: fromUserId, chatId, commit })
                commit('SET_CALL_STATE', { peerConnection: pc })
                await pc.setRemoteDescription(new RTCSessionDescription(sdp))
                const answer = await pc.createAnswer()
                await pc.setLocalDescription(answer)
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
                if (!state.peerConnection || !candidate) return
                console.log('[CALL] Remote ICE candidate received:', candidate?.candidate || '')
                await state.peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
            } catch (err) {
                logError('handleIceCandidate', err)
            }
        },

        endCall ({ commit, state, rootState }) {
            const socket = rootState.chat.socket
            if (socket && state.toUserId && state.chatId) {
                socket.emit('callEnd', { toUserId: state.toUserId, chatId: state.chatId })
            }
            stopTracks(state.localStream, 'localStream')
            stopTracks(state.remoteStream, 'remoteStream')
            closePc(state.peerConnection)
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
            stopTracks(state.localStream, 'localStream')
            stopTracks(state.remoteStream, 'remoteStream')
            closePc(state.peerConnection)
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
