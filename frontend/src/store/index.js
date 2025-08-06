import { createStore } from 'vuex'
import auth from './modules/auth'
import chat from './modules/chat'
import user from './modules/user'

export default createStore({
    modules: {
        auth,
        chat,
        user
    }
})
