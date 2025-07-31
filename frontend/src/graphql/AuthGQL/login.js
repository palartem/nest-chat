import gql from 'graphql-tag';

export default {
    mutation: gql`
    mutation Login($email: String!, $password: String!) {
      login(email: $email, password: $password) {
        access_token
        refresh_token
        user {
          id
          name
          email
          confirmed
        }
      }
    }
  `,
    variables: {
        email: '',
        password: ''
    }
};
