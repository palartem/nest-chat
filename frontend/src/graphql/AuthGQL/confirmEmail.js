import gql from 'graphql-tag';

export default {
    mutation: gql`
    mutation ConfirmEmail($token: String!) {
      confirmEmail(token: $token) {
            id
            email
            confirmed
        }
    }
  `,
    variables: {
        token: ''
    }
};
