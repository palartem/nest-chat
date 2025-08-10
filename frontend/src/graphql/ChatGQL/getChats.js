import gql from 'graphql-tag'

export const GET_CHATS = gql`
  query Chats($userId: Int!) {
    chats(userId: $userId) {
      id
      participants {
        id
        name
        email
      }
      lastMessage {
        id
        content
        createdAt
        sender {
          id
          email
        }
      }
    }
  }
`
