const routes = [
  {
    path: '/',
    component: () => import('layouts/MainLayout.vue'),
    children: [
      {
        path: '',
        component: () => import('pages/IndexPage.vue'),
        meta: { requiresAuth: true }
      },
      { path: 'login', component: () => import('pages/AuthPage.vue') },
      { path: 'confirm', component: () => import('pages/ConfirmPage.vue') }
    ]
  },

  {
    path: '/chats',
    component: () => import('layouts/ChatLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        component: () => import('pages/chat/EmptyChat.vue')
      },
      {
        path: ':chatId',
        component: () => import('pages/chat/ChatRoom.vue')
      }
    ]
  },

  {
    path: '/:catchAll(.*)*',
    component: () => import('pages/ErrorNotFound.vue')
  }
]

export default routes
