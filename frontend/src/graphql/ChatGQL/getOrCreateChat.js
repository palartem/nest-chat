import gql from 'graphql-tag'

export const GET_OR_CREATE_CHAT = gql`
  mutation GetOrCreateChat($userAId: Int!, $userBId: Int!) {
    getOrCreateChat(userAId: $userAId, userBId: $userBId) {
      id
      participants {
        id
        email
      }
      lastMessage {
        id
        content
        createdAt
      }
    }
  }
`
