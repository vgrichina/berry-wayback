let walletConnection;
let account;

const CONTRACT_NAME = 'berry-or-not.near'
const APP_PREFIX = CONTRACT_NAME + ':keystore:';

async function vote(event) {
    event.preventDefault();
    console.log('vote');

    await account.functionCall(CONTRACT_NAME, 'vote', {
        players: Array.from(document.querySelectorAll('button.vote')).map(button => ({
            id: button.value,
            score: event.target == button ? 100 : 0
        }))
    });
}

async function login() {
    console.log('login');
    await walletConnection.requestSignIn(CONTRACT_NAME);
}

async function logout() {
    console.log('logout');
    await walletConnection.signOut();
}

(async function() {
    const near = await nearApi.connect({
        networkId: 'default',
        walletUrl: 'https://wallet.near.org',
        nodeUrl: 'https://rpc.mainnet.near.org',
        keyStore: new nearApi.keyStores.BrowserLocalStorageKeyStore(localStorage, APP_PREFIX)
    });
    walletConnection = new nearApi.WalletConnection(near, APP_PREFIX);
    window.walletConnection = walletConnection;

    if (!walletConnection.isSignedIn()) {
        document.querySelectorAll('.require-login').forEach(el => el.style.display = 'none');
    } else {
        document.querySelectorAll('.require-no-login').forEach(el => el.style.display = 'none');
        document.querySelector('.account-name').textContent = walletConnection.getAccountId();
        account = await walletConnection.account();
    }
})().catch(console.error);