import React, { Component } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { withApollo } from 'react-apollo';
import { gql } from 'apollo-boost';
import Users from './Users';
import AuthorizedUser from './AuthorizedUser';

export const ROOT_QUERY = gql`
  query allUsers {
    totalUsers
    allUsers { ...userInfo }
    me { ...userInfo }
  }

  fragment userInfo on User {
    githubLogin
    name
    avatar
  }
`

const LISTEN_FOR_USERS = gql`
    subscription {
        newUser {
            githubLogin
            name
            avatar
        }
    }
`

class App extends Component {

  componentDidMount() {
    let { client } = this.props
    this.listenForUsers = client
      .subscribe({ query: LISTEN_FOR_USERS })
      .subscribe(({ data: { newUser } }) => {
        console.log('here now')
        const data = client.readQuery({ query: ROOT_QUERY })
        data.totalUsers += 1
        data.allUsers = [
          ...data.allUsers,
          newUser
        ]
        client.writeQuery({ query: ROOT_QUERY, data })
      }) 
  }

  componentWillUnmount() {
    this.listenForUsers.unsubscribe()
  }

  render() {
    return (
      <BrowserRouter>
        <div>
          <AuthorizedUser />
          <Users />
        </div>
      </BrowserRouter>
    )
  }
}

export default withApollo(App);
