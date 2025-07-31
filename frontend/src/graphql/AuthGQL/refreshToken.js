import gql from 'graphql-tag';

export default {
    mutation: gql`
    mutation RefreshToken($token: String!) {
      refreshToken(token: $token) {
        access_token
        refresh_token
      }
    }
  `,
    variables: {
        token: ''
    }
};
