import gql from 'graphql-tag'

export const GET_MESSAGES = gql`
  query MessagesForChat($chatId: Int!) {
    messagesForChat(chatId: $chatId) {
      id
      content
      createdAt
      sender {
        id
        email
        name
      }
    }
  }
`
