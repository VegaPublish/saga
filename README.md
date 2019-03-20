# Saga

Backend for [Vega](https://github.com/vegapublish/vega)

## Prerequisites

- MongoDB v3.x or newer
- Node.js v8.x or newer
- npm v6.x or newer

## Up and running on your local computer

### Database

`Saga` uses mongodb as its backend database. If you're on a mac and want to get started quickly, just

```
brew install mongodb
brew services start mongodb
```

Otherwise [download the appropriate build](https://docs.mongodb.com/manual/administration/install-community), install, start up and ensure that it is alive and well on `mongodb://localhost:27017`

If you want a UI to inspect your mongodb, (Compass)[https://www.mongodb.com/download-center/compass] is a good tool.

### Get the `Saga` source code by cloning the repository

```
git clone git@github.com:VegaPublish/saga.git
```

### Install dependencies

```
cd saga
npm install
```

### Configure OAuth

As a part of the initial setup, a root user needs to be added to the system.
In order to claim the root user, a oauth config file must be created in `./config/oauth.json` (take a look at `./config/oauth.fallback.json` for an example using the [Google OAuth 2.0 auth strategies](https://github.com/jaredhanson/passport-google-oauth2).

To use the provided Google OAuth strategy, make sure to add an oauth application at the [Google developer console](https://console.developers.google.com/apis/credentials). More about [OAth2 here](https://developers.google.com/identity/protocols/OAuth2).

Note: The Google developer console can be a bit finnicky. If you get lost in there, ask someone who's been there before. Your mission is to locate the OAuth consent screen and:

- Create OAuth 2.0 client IDs for a web appliation
- You should add http://127.0.0.1:4000 to "Authorized JavaScript origins"
- Also add http://127.0.0.1:4000/v1/auth/callback/google to "Authorized redirect URIs"
- Copy the Client ID and Secret ID, and paste them into `./config/oauth.json`.

If you want to use another strategy than Google OAuth 2.0, please refer to the [Passport.js wiki](https://github.com/jaredhanson/passport/wiki/Strategies).

## Launching Saga for the first time

Once OAuth is configured, proceed to start Saga:

```
npm run start
```

Now, with Saga running, open another terminal and run `npm run setup` from the Saga folder. This will guide you through the process of claiming a root user and setting up the default venue.

## Adding additional venues

After first setup, you can create new venues by running `npm run create-venue`. This will guide you through the necessary steps.

## Installing Vega

Follow instructions on the (Vega readme)[https://github.com/VegaPublish/vega].

## Deployment

**Caution ☠️** If this is your first time setting up the whole Saga/Vega stack, be nice to yourself and don't try anything fancy. Set up the whole thing with default values on your own local computer.

Once the whole stack purrs like a smug cat on you local machine and you feel it's time for a more permanent deployment, proceed as follows:

1. Keep your local stack running.
2. Install and fire up mongodb on the server where you want it to run.
3. Point your local Saga to your new mongodb instance.
4. Confirm that Vega+Saga on your local machine runs fine with the remotely running mongodb.
5. ✅ mongodb done!
6. Install and fire up Saga where you want it to run. Tell it use your newly deployed mongodb.
7. Point your local Vega to your new instance of Saga.
8. Confirm that Vega on your local machine runs fine with the remotely installed mongodb and Saga.
9. ✅ Saga done!
10. Install and fire up Vega where you want it to run. Tell it use your newly deployed Saga.
11. Confirm that everything still works.
12. ✅ All done!

## Saga config options

### List of possible environment variables:

- `SAGA_HTTP_PORT`: The port to run the backend on (default `4000`)
- `SAGA_HTTP_HOST`: Which HTTP host to run on: (default `127.0.0.1`)
- `SAGA_LOG_LEVEL`: The loglevel to use (passed on to `pino` which is used for logging) (default `info`)
- `SAGA_SESSION_NAME`: Session name (default `sagaSession`)
- `SAGA_SESSION_SECRET`: Session secret
- `SAGA_SESSION_TTL_MS`: Session cookie TTL
- `SAGA_AUTH_PROVIDERS_CONFIG_PATH`: Path to oauth provider config (default `./config/oauth.json`)
- `SAGA_DATA_MAX_INPUT_BYTE`: Payload size limit for posted data (default 2MB)
- `SAGA_ASSETS_MAX_INPUT_BYTE`: Size limit for uploaded assets (default 15MB)
- `SAGA_ASSETS_FS_BASE_PATH`: The base path of assets stored on disk (default `./data/assets/`)
- `SAGA_CORS_MAX_AGE`: Configures the Access-Control-Max-Age CORS header (default `600` ms)
- `SAGA_CORS_ORIGINS`: A comma delimited string with all the allowed CORS origins.
- `SAGA_CORS_EXPOSED_HEADER`: Configures the Access-Control-Expose-Headers CORS headers. This will be added in addition to `Content-Type`, `Content-Length` and `ETag`
- `SAGA_MONGODB_URL`: URL to MongoDB instance (default `mongodb://localhost:27017`)
- `SAGA_BASE_URL` : The base URL where Saga is publicly available, (default: `'http://localhost:4000'`)

# About the name

Saga is an abbreviation of Sagittarus A\* which is the radio source likely to be the supermassive black hole at the center of the Milky Way galaxy ♐

# Data import

A quick note on data import: You may find yourself in the situation that you need to pour some raw data into mongo. Try this:

```
mongoimport --host localhost:27017 --db saga-MYVENUE --collection documents --mode upsert --file ./MYVENUE-dump.ndjson
```
