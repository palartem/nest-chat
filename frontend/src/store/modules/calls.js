const DEBUG = String(import.meta.env.VITE_RTC_DEBUG || '').trim() === '1'
const dbg = (...a) => { if (DEBUG) console.log(...a) }
const wrn = (...a) => { if (DEBUG) console.warn(...a) }
const err = (...a) => { if (DEBUG) console.error(...a) }

const FAST_VIDEO = {
    facingMode: 'user',
    width: { ideal: 640 },
    height: { ideal: 360 },
    frameRate: { ideal: 15, max: 30 }
}
const HD_VIDEO = {
    facingMode: 'user',
    width: { ideal: 1280 },
    height: { ideal: 720 },
    frameRate: { ideal: 30 }
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
const isForceTurn = () => String(import.meta.env.VITE_FORCE_TURN || '').trim() === '1'

function stopTracks (stream, label) {
    if (!stream) return
    try { stream.getTracks().forEach(t => t.stop()) } catch (e) { wrn(`stop ${label}`, e) }
}
function closePc (pc) {
    if (!pc) return
    try { pc.close() } catch (e) { wrn('close peerConnection', e) }
}

function rtcConfig () {
    const urls = (import.meta.env.VITE_TURN_URLS || '').split(',').map(s => s.trim()).filter(Boolean)
    const username = import.meta.env.VITE_TURN_USERNAME
    const credential = import.meta.env.VITE_TURN_CREDENTIAL
    const disableTurnLocal = String(import.meta.env.VITE_DISABLE_TURN_LOCAL || '') === '1'
    const isLocal = isLocalNetworkHost(window.location.hostname)

    if (isForceTurn()) {
        const tcpOnly = urls.filter(u => /transport=tcp/i.test(u) || /^turns:/i.test(u))
        const ordered = [
            ...tcpOnly.filter(u => /^turns:/i.test(u)),
            ...tcpOnly.filter(u => !/^turns:/i.test(u))
        ]
        const iceServers = ordered.map(u => ({ urls: u, username, credential }))
        return {
            iceServers,
            iceTransportPolicy: 'relay',
            bundlePolicy: 'max-bundle',
            iceCandidatePoolSize: 1
        }
    }

    const iceServers = [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
    if (!(disableTurnLocal && isLocal) && urls.length && username && credential) {
        urls.forEach(u => iceServers.push({ urls: u, username, credential }))
    }
    return { iceServers, bundlePolicy: 'max-bundle', iceCandidatePoolSize: 1 }
}

function logError (scope, e) {
    err(`[${scope}]`, e?.name || e, e?.message || '')
}

function preferCodecs (pc) {
    try {
        const setPref = (kind, mime) => {
            const caps = RTCRtpSender.getCapabilities?.(kind)
            if (!caps?.codecs) return
            const preferred = caps.codecs.filter(c => c.mimeType?.toLowerCase() === mime)
            const rest = caps.codecs.filter(c => c.mimeType?.toLowerCase() !== mime)
            pc.getTransceivers?.().forEach(t => {
                if (t?.sender?.track?.kind === kind && t.setCodecPreferences) {
                    t.setCodecPreferences([...preferred, ...rest])
                }
            })
        }
        setPref('video', 'video/VP8')
        setPref('audio', 'audio/opus')
    } catch (e) {
        wrn('preferCodecs', e)
    }
}

async function upgradeToHD (pc, commit) {
    try {
        const newStream = await navigator.mediaDevices.getUserMedia({ video: HD_VIDEO, audio: true })
        const newVideo = newStream.getVideoTracks()[0]
        if (!newVideo) return
        // заменяем только видео-трек
        const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video')
        if (sender) await sender.replaceTrack(newVideo)
        // соберём новый stream для локального видео: старый аудио + новый видео
        const mixed = new MediaStream()
        mixed.addTrack(newVideo)
        const currentAudioSender = pc.getSenders().find(s => s.track && s.track.kind === 'audio')
        if (currentAudioSender?.track) mixed.addTrack(currentAudioSender.track)
        commit('SET_LOCAL_STREAM', mixed)
        dbg('[CALL] upgraded to HD')
    } catch (e) {
        wrn('upgradeToHD', e)
    }
}

function attachPcHandlers (pc, { socket, toUserId, chatId, commit }) {
    let restartTimer = null
    let restartInFlight = false
    let upgraded = false

    const tryIceRestart = async () => {
        if (restartInFlight || !pc) return
        restartInFlight = true
        try {
            const offer = await pc.createOffer({ iceRestart: true })
            await pc.setLocalDescription(offer)
            socket.emit('callRenegotiate', { toUserId, chatId, sdp: offer })
            dbg('[CALL] ICE restart sent')
        } catch (e) {
            wrn('iceRestart', e)
        } finally {
            restartInFlight = false
        }
    }

    pc.ontrack = (e) => {
        const stream = e.streams?.[0]
        if (stream) {
            dbg('[CALL] Remote track:', e.track?.kind, e.track?.id)
            commit('SET_REMOTE_STREAM', stream)
        }
    }

    pc.onicecandidate = (event) => {
        if (!event.candidate) { dbg('[CALL] All local ICE candidates sent'); return }
        dbg('[CALL] Local ICE candidate:', event.candidate.candidate || '')
        socket.emit('callIce', { toUserId, chatId, candidate: event.candidate })
    }

    pc.onicegatheringstatechange = () => { dbg('[CALL] ICE gathering state:', pc.iceGatheringState) }

    pc.oniceconnectionstatechange = () => {
        const st = pc.iceConnectionState
        dbg('[CALL] ICE state:', st)

        // быстрый апгрейд до HD после установления канала
        if (!upgraded && (st === 'connected' || st === 'completed')) {
            upgraded = true
            upgradeToHD(pc, commit)
            clearTimeout(restartTimer)
            return
        }

        if (st === 'failed' || st === 'disconnected') {
            clearTimeout(restartTimer)
            restartTimer = setTimeout(() => {
                if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') tryIceRestart()
            }, 1500)
        }
    }

    pc.onconnectionstatechange = () => { dbg('[CALL] Conn state:', pc.connectionState) }
    pc.onicecandidateerror = (e) => {
        wrn('[CALL] ICE candidate error:', {
            url: e.url, hostCandidate: e.hostCandidate, errorCode: e.errorCode, errorText: e.errorText
        })
    }
    pc.onnegotiationneeded = () => { /* no-op */ }

    return pc
}

async function getMediaFastStart () {
    // быстрый старт — лёгкие констрейнты
    try {
        return await navigator.mediaDevices.getUserMedia({ video: FAST_VIDEO, audio: true })
    } catch (e) {
        wrn('[getUserMedia] fast failed:', e?.name, e?.message)
        // запасной вариант
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
                const localStream = await getMediaFastStart()
                commit('SET_LOCAL_STREAM', localStream)

                const pc = new RTCPeerConnection(rtcConfig())
                // добавляем треки до createOffer
                localStream.getTracks().forEach(tr => pc.addTrack(tr, localStream))
                preferCodecs(pc)

                attachPcHandlers(pc, { socket, toUserId, chatId, commit })
                commit('SET_CALL_STATE', { peerConnection: pc })

                const offer = await pc.createOffer()
                await pc.setLocalDescription(offer)

                socket.emit('callInvite', { toUserId, chatId, sdp: offer })
            } catch (e) {
                logError('startCall', e)
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
                const localStream = await getMediaFastStart()
                commit('SET_LOCAL_STREAM', localStream)

                const pc = new RTCPeerConnection(rtcConfig())
                localStream.getTracks().forEach(tr => pc.addTrack(tr, localStream))
                preferCodecs(pc)

                attachPcHandlers(pc, { socket, toUserId: fromUserId, chatId, commit })
                commit('SET_CALL_STATE', { peerConnection: pc })

                await pc.setRemoteDescription(new RTCSessionDescription(sdp))
                const answer = await pc.createAnswer()
                await pc.setLocalDescription(answer)

                socket.emit('callAnswer', { toUserId: fromUserId, chatId, sdp: answer })
            } catch (e) {
                logError('receiveCall', e)
                this.dispatch('calls/endCallSilent', null, { root: true })
            }
        },

        async handleCallAnswer ({ state }, { sdp }) {
            try {
                if (!state.peerConnection) return
                await state.peerConnection.setRemoteDescription(new RTCSessionDescription(sdp))
            } catch (e) {
                logError('handleCallAnswer', e)
            }
        },

        async handleIceCandidate ({ state }, { candidate }) {
            try {
                if (!state.peerConnection || !candidate) return
                dbg('[CALL] Remote ICE candidate received:', candidate?.candidate || '')
                await state.peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
            } catch (e) {
                logError('handleIceCandidate', e)
            }
        },

        async handleRenegotiate ({ state, rootState }, { fromUserId, chatId, sdp }) {
            try {
                const pc = state.peerConnection
                if (!pc) return
                const socket = rootState.chat.socket
                await pc.setRemoteDescription(new RTCSessionDescription(sdp))
                const answer = await pc.createAnswer()
                await pc.setLocalDescription(answer)
                socket.emit('callRenegotiateAnswer', { toUserId: fromUserId, chatId, sdp: answer })
            } catch (e) {
                logError('handleRenegotiate', e)
            }
        },

        async handleRenegotiateAnswer ({ state }, { sdp }) {
            try {
                const pc = state.peerConnection
                if (!pc) return
                await pc.setRemoteDescription(new RTCSessionDescription(sdp))
            } catch (e) {
                logError('handleRenegotiateAnswer', e)
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
