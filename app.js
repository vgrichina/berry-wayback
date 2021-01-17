const { connect, keyStores: { InMemoryKeyStore } } = require('near-api-js');

const CANVAS_SCALE = 8;
const BOARD_SIZE = 50;

async function viewPixelBoard(blockId) {
    const config = require('./config')(process.env.NODE_ENV || 'development')
    // TODO: Why no default keyStore?
    const keyStore = new InMemoryKeyStore();
    const near = await connect({...config, keyStore});
    const account = await near.account('berryclub.ek.near');
    if (blockId && /^\d+$/.exec(blockId)) {
        blockId = parseInt(blockId, 10);
    }
    const pixelsState = await account.viewState('p', blockId ? { blockId } : null);
    const lines = pixelsState.map(({key, value}) => {
        const linePixels = value.slice(4);
        const width = linePixels.length / 8;
        const lineColors = [];
        for (let i = 0; i < width; i++) {
            lineColors.push(linePixels.slice(i * 8, i * 8 + 3).reverse().toString('hex'));
        }
        return lineColors;
    });


    const { createCanvas } = require('canvas');
    const scale = CANVAS_SCALE;
    const canvas = createCanvas(BOARD_SIZE * scale, BOARD_SIZE * scale);
    const ctx = canvas.getContext('2d');
    lines.forEach((line, y) => {
        line.forEach((color, x) => {
            ctx.fillStyle = `#${color}`;
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
// const SERVER_URL = 'https://vg-1eb72eb9.localhost.run';

router.get('/img/:blockId?', async ctx => {
    console.log(ctx.path);

    ctx.type = "image/png";
    ctx.body = await viewPixelBoard(ctx.params.blockId);
});

const oembed = require('koa-oembed');
router.get('/oembed', oembed(`${SERVER_URL}/board/*`), function (ctx) {
    console.log('hmmmmmmmmm');
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

router.get('/board/:blockId?', async ctx => {
    const { blockId } = ctx.params;
    const imageUrl = `${SERVER_URL}/img/${blockId}`;
    ctx.type = 'text/html';
    ctx.body = `
        <meta name="twitter:image:src" content="${imageUrl}">
        <meta name="twitter:image:width" content="${BOARD_SIZE * CANVAS_SCALE}">
        <meta name="twitter:image:height" content="${BOARD_SIZE * CANVAS_SCALE}">

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

        <link rel="alternate" type="application/json+oembed"
  href="${SERVER_URL}/oembed?url=${encodeURIComponent(`${SERVER_URL}${ctx.url}`)}&format=json"
  title="Berry Club Snapshot" />

        <p>Made in <a href="https://berryclub.io">🥑 club</a>.

        <p><img src="${imageUrl}">
    `;
});

const indexer = require('./indexer');
router.get('/:accountId?', async ctx => {
    console.log(ctx.path);

    const { accountId } = ctx.params;

    const edits = await indexer.findEdits(accountId);
    edits.sort((a, b) => parseFloat(a.block_timestamp) - parseFloat(b.block_timestamp));

    ctx.type = 'text/html';
    ctx.body = `
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
        <p>Welcome to <a href="https://berryclub.io">🥑 club</a> time machine.

        ${
            accountId
                ? `You are viewing sample of pictures where <a href="https://explorer.near.org/accounts/${accountId}">${accountId}</a> has contributed.`
                : `You are viewing sample of pictures made by Berry Club users.`
        }
        <p>Refresh your browser to see a different sample.

        ${
            edits.map(({ block_hash }) => {
                const boardUrl = `${SERVER_URL}/board/${block_hash}`
                return `
                    <p><img src="/img/${block_hash}">
                    <a class="twitter-share-button" href="https://twitter.com/intent/tweet?text=${
                        encodeURIComponent(`Check out Berry Club`)}&url=${encodeURIComponent(boardUrl)}">Tweet</a>
                `
            }).join('\n')
        }
    `;
});

app
    .use(router.routes())
    .use(router.allowedMethods());

const PORT = process.env.PORT || 3000;
app.listen(PORT);
console.log('Listening on http://localhost:%d/', PORT);
