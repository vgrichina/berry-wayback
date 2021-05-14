const { connect, keyStores: { InMemoryKeyStore } } = require('near-api-js');

async function connectNear() {
    const config = require('./config')(process.env.NODE_ENV || 'development')
    // TODO: Why no default keyStore?
    const keyStore = new InMemoryKeyStore();
    const near = await connect({...config, keyStore});
    const account = await near.account('berryclub.ek.near');
    return { config, keyStore, near, account };
}

const BoardHeight = 50;
const BoardWidth = 50;
const ExpectedLineLength = 4 + 8 * BoardWidth;

const decodeLine = (line) => {
    let buf = Buffer.from(line, 'base64');
    if (buf.length !== ExpectedLineLength) {
        throw new Error("Unexpected encoded line length");
    }
    let pixels = []
    for (let i = 4; i < buf.length; i += 8) {
        let color = buf.readUInt32LE(i);
        // let ownerIndex = buf.readUInt32LE(i + 4);
        pixels.push(color);
    }
    return pixels;
};
const intToColor = (c) => `#${c.toString(16).padStart(6, '0')}`;

async function viewPixelBoard(blockId) {
    const { account } = await connectNear();

    if (blockId && /^\d+$/.exec(blockId)) {
        blockId = parseInt(blockId, 10);
    }

    const args = {lines: [...Array(BoardHeight).keys()]};
    const rawResult = await account.connection.provider.query({
        request_type: 'call_function',
        block_id: blockId,
        finality: blockId ? undefined : 'optimistic',
        account_id: account.accountId,
        method_name: 'get_lines',
        args_base64: Buffer.from(JSON.stringify(args), 'utf8').toString('base64'),
    });
    const result = rawResult.result && rawResult.result.length > 0 && JSON.parse(Buffer.from(rawResult.result).toString());
    const lines = result.map(decodeLine);

    const { createCanvas } = require('canvas');
    const scale = 8;
    const canvas = createCanvas(50 * scale, 50 * scale);
    const ctx = canvas.getContext('2d');
    lines.forEach((line, y) => {
        line.forEach((color, x) => {
            ctx.fillStyle = intToColor(color);
            ctx.fillRect(x * scale, y * scale, scale, scale);
        });
    });

    return canvas.toBuffer();
}


const Koa = require('koa');
const app = new Koa();

const Router = require('koa-router');
const router = new Router();

const SERVER_URL = 'https://wayback.berryclub.io';

router.get('/img/:blockId?', async ctx => {
    ctx.type = "image/png";
    ctx.body = await viewPixelBoard(ctx.params.blockId);
});

const oembed = require('koa-oembed');
router.get('/oembed', oembed(`${SERVER_URL}/board/*`), function (ctx) {
    const photoId = ctx.oembed.match[1] // regex match of first wildcard.
    // match[0] is the fully matched url; 1, 2, 3... store wildcard matches

    // TODO: Some generic validation
    // if (!checkIfExists(photoId)) {
    //     ctx.throw(404)
    // }

    ctx.oembed.photo({
        url: `https://wayback.berryclub.io/img/${photoId}`,
        width: 400,
        height: 400
    })
})

const commonStyles = `
    <style>
        p, img {
            max-width: 90vh;
            margin: 0.5em auto;
        }
        img {
            width: 100%;
            display: block;
            image-rendering: pixelated;
            image-rendering: crisp-edges;
        }
    </style>
`;

router.get('/board/:blockId?', async ctx => {
    const { blockId } = ctx.params;
    ctx.type = 'text/html';
    ctx.body = `
        ${commonStyles}

        <link rel="alternate" type="application/json+oembed"
  href="${SERVER_URL}/oembed?url=${encodeURIComponent(`${SERVER_URL}${ctx.url}`)}&format=json"
  title="Berry Club Snapshot" />

        <p>Made in <a href="https://berryclub.io">🥑 club</a>.

        <p><img src="/img/${blockId}">
    `;
});

router.get('/rate/:blockId1/vs/:blockId2', async ctx => {
    const { blockId1, blockId2 } = ctx.params;

    const board = blockId => `
        <div class="board">
            <img src="/img/${blockId}">
            <button class="require-login vote" value="${blockId}" onclick="vote(event)">This 🍅 is juicier</button>
        </div>
    `;

    ctx.type = 'text/html';
    ctx.body = `
        ${commonStyles}
        <style>
            img {
                width: 50vh;
            }

            .container {
                display: flex;
                justify-content: center;
            }

            .board {
                padding: 0.5em;
            }
        </style>

        <p>Which 🍅 is <a href="/juiciest">juicier?</a></p>

        <div class="container">
            ${board(blockId1)}
            ${board(blockId2)}
        </div>

        <p>
            <a href="/rate-random">Rate Another Pair</a>
        </p>

        <p class="require-no-login"><a href="javascript:login()">Login with NEAR Wallet</a> to vote</p>
        <p class="require-login">You are logged in as <b class="account-name">...</b> | <a href="javascript:logout()">Logout</a></p>

        <script src='https://cdn.jsdelivr.net/npm/near-api-js@0.36.2/dist/near-api-js.js'></script>
        <script src='/vote.js'></script>
    `;
});

const indexer = require('./indexer');

router.get('/rate-random', async ctx => {
    const [ id1, id2 ] = await indexer.findRandomPair();
    ctx.redirect(`/rate/${id1}/vs/${id2}`);
});

router.get('/juiciest', async ctx => {
    const { near } = await connectNear();
    const account = await near.account('berry-or-not.near');

    const boards = (await account.viewState('elo')).map(({ key, value }) => ({
        elo: parseFloat(value.toString('utf-8')),
        boardId: key.toString('utf-8').substring('elo:'.length)
    })).sort((a, b) => b.elo - a.elo);

    console.log('boards', boards);

    ctx.type = 'text/html';
    ctx.body = `
        ${commonStyles}

        <p>Welcome to <a href="https://berryclub.io">🥑 club</a> time machine.

        <p>You are viewing the juiciest pictures made by Berry Club users.<p>
        <p><a href="/rate-random">Vote for best pictures</a>

        ${
            boards.map(({ boardId }) => `<p><img src="/img/${boardId}" width="500">`).join('\n')
        }
    `;
});

router.get('/:accountId?', async ctx => {
    const { accountId } = ctx.params;

    const edits = await indexer.findEdits(accountId);
    edits.sort((a, b) => parseFloat(a.block_timestamp) - parseFloat(b.block_timestamp));

    ctx.type = 'text/html';
    ctx.body = `
        ${commonStyles}

        <p>Welcome to <a href="https://berryclub.io">🥑 club</a> time machine.

        ${
            accountId
                ? `You are viewing sample of pictures where <a href="https://explorer.near.org/accounts/${accountId}">${accountId}</a> has contributed.` 
                : `You are viewing sample of pictures made by Berry Club users.`
        }
        <p>Refresh your browser to see a different sample.

        ${
            edits.map(({ block_hash }) => `<p><img src="/img/${block_hash}" width="500">`).join('\n')
        }
    `;
});

app
    .use(async (ctx, next) => {
        console.log(ctx.method, ctx.path);
        await next();
    })
    .use(require('koa-static')('public'))
    .use(router.routes())
    .use(router.allowedMethods());

const PORT = process.env.PORT || 3000;
app.listen(PORT);
console.log('Listening on http://localhost:%d/', PORT);
