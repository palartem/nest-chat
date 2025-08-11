import { createStore } from 'vuex'
import auth from './modules/auth'
import chat from './modules/chat'
import user from './modules/user'
import calls from './modules/calls'

export default createStore({
    modules: {
        auth,
        chat,
        user,
        calls
    }
})
