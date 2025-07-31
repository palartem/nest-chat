import gql from 'graphql-tag';

const REGISTER_MUTATION = gql`
  mutation Register($data: CreateUserInput!) {
    register(data: $data) {
      id
      email
      name
      confirmed
    }
  }
`;

export default REGISTER_MUTATION;
