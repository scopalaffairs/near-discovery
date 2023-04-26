import { isSignInWithEmailLink, signInWithEmailLink } from 'firebase/auth';

import React from 'react';
import { firebaseAuth } from '../utils/firebase';
import styled from 'styled-components';
import { toast } from 'sonner'
import { useHistory } from 'react-router-dom';

const AuthCallbackHandler = () => {
    const history = useHistory();
    const [statusMessage, setStatusMessage] = React.useState('Loading...');

    React.useEffect(() => {
        const locationUrl = window.location.href;

        if (isSignInWithEmailLink(firebaseAuth, locationUrl)) {

            const url = new URL(locationUrl);
            const searchParams = new URLSearchParams(url.search);
            const accountId = searchParams.get("accountId");
            const publicKey = searchParams.get("publicKey");
            const isRecovery = searchParams.get("isRecovery") === 'true';

            let email = window.localStorage.getItem('emailForSignIn');

            setStatusMessage('Verifying email...');
            signInWithEmailLink(firebaseAuth, email, window.location.href)
                .then(async (result) => {
                    window.localStorage.removeItem('emailForSignIn');

                    const user = result.user;
                    if (!!user.emailVerified) {
                        setStatusMessage(isRecovery ? 'Recovering account...' : 'Creating account...');

                        // TODO: Call MPC Service with accountId, publicKey,  and oauthToken to create account
                        const data = {
                            ...(accountId && accountId.includes('.') ? {near_account_id: accountId} : {}),
                            public_key: publicKey,
                            oidc_token: user.accessToken
                        };

                        const headers = new Headers();
                        headers.append("Content-Type", "application/json");

                        const options = {
                            method: 'POST',
                            mode: "cors",
                            body: JSON.stringify(data),
                            headers
                        };

                        await fetch(`https://mpc-recovery-7tk2cmmtcq-ue.a.run.app/${isRecovery ? 'add_key' : 'new_account'}`, options)
                            .then(async (response) => {
                                if (!response.ok) {
                                    console.log(response)
                                    throw new Error('Network response was not ok');
                                }
                                setStatusMessage(isRecovery ? 'Account recovered successfully!' : 'Account created successfully!');
                                const accountCreationData = JSON.parse(window.localStorage.getItem('fast-auth:account-creation-data') || JSON.stringify({}));
                                const res = await response.json()
                                const accId = accountCreationData.accountId || res.near_account_id
                                // TODO: Check if account ID matches the one from email
                                if (!accountCreationData.privateKey || !accId) throw ('Could not find account creation data');

                                window.localStorage.setItem('fast-auth:account-creation-data', JSON.stringify({
                                    ...accountCreationData,
                                    accountId: accId,
                                    isCreated: true
                                }));

                                setStatusMessage('Redirecting to app...');

                                window.location.href = '/';
                            });
                    }
                })
                .catch((error) => {
                    console.log(error)
                    const message = ({
                        'auth/expired-action-code': 'Link expired, please try again.',
                        'auth/invalid-action-code': 'Link expired, please try again.',
                        'auth/invalid-email': 'Invalid email address.',
                        'auth/user-disabled': 'User disabled',
                        'auth/missing-email': 'No email found, please try again.'
                    })[error.code] || error.message
                    history.push('/signup')
                    console.log(message, 'meassage', typeof message)
                    toast.error(message)
                });
        } else {
            history.push('/signup')
        }
    }, [])

    return (
        <StyledStatusMessage>{statusMessage}</StyledStatusMessage>
    )
}


export default AuthCallbackHandler

const StyledStatusMessage = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 80vh;
    width: 100%;
`
