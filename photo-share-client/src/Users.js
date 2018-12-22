import React from 'react';
import { Query, Mutation } from 'react-apollo';
import { gql } from 'apollo-boost';
import { ROOT_QUERY } from './App';

const ADD_FAKE_USERS_MUTATION = gql`
  mutation addFakeUsers($count: Int!) {
    addFakeUsers(count:$count) {
      githubLogin
      name
      avatar
    }
  }
` 
const Users = () => 
  <Query query={ROOT_QUERY}>
    {({data, loading, refetch}) => {
      console.log(data, loading)
      if (loading)
      return <p> Loading users...</p>
      else {
        return (
          <UserList
            count={data.totalUsers}
            users={data.allUsers}
            refetchUsers={refetch}
          />
        )
      }
    }
    }
  </Query>

const UserList = ({ count, users, refetchUsers }) =>
  <div> 
    <p>{count} Users</p>
    <button onClick={() => refetchUsers()}>Refetch</button>
    <Mutation 
      mutation={ADD_FAKE_USERS_MUTATION} 
      variables={{ count: 1 }}
    >
      {addFakeUsers =>
        <button onClick={addFakeUsers}>Add Fake Users</button>
      }
    </Mutation>
    <ul>
      {users.map(u =>
        <UserListItem 
          key={u.githubLogin}
          name={u.name}
          avatar={u.avatar}
        />
      )}
    </ul>
  </div>

const UserListItem = ({ name, avatar }) =>
  <li>
    <img src={avatar} width={48} height={48} alt=""/>
    {name}
  </li>
      

  export default Users;