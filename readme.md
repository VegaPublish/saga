# Saga Install Guide

This document specifically describes the process to install Saga on Ubuntu 16.04. 


### **Prerequisites**


*   MongoDB v3.x or newer
*   Node.js v8.x or newer
*   npm v6.x or newer

**Notes: **[Saga](https://github.com/VegaPublish/saga) [[https://github.com/VegaPublish/saga](https://github.com/VegaPublish/saga)] is the backend required to run Vega. 

[Vega](https://github.com/VegaPublish/vega) [[https://github.com/VegaPublish/vega](https://github.com/VegaPublish/vega)] is the editing environment which runs in the browser and makes editors happy. Lyra is the UI platform which Vega runs on. You must install both Saga and Vega for Vega to work.

Start the process by ensuring that Node.js and npm are installed on the server. A good guide to installing Node.js on Ubuntu 16.04 can be found here: [https://www.digitalocean.com/community/tutorials/how-to-install-node-js-on-ubuntu-16-04](https://www.digitalocean.com/community/tutorials/how-to-install-node-js-on-ubuntu-16-04).


### **Install MongoDB**

Saga uses mongodb as its backend database. Two good guides to installing MongoDB on Ubuntu 16.04 can be found here: [https://www.digitalocean.com/community/tutorials/how-to-install-mongodb-on-ubuntu-16-04](https://www.digitalocean.com/community/tutorials/how-to-install-mongodb-on-ubuntu-16-04) [https://www.linode.com/docs/databases/mongodb/install-mongodb-on-ubuntu-16-04/#install-mongodb](https://www.linode.com/docs/databases/mongodb/install-mongodb-on-ubuntu-16-04/#install-mongodb).

[If you're on a mac and want to get started quickly, just


```
brew install mongodb
brew services start mongodb]
```

Otherwise [download the appropriate build](https://docs.mongodb.com/manual/administration/install-community), install, start up and ensure that it is alive and well on `mongodb://localhost:27017.`

If you want a UI to inspect your mongodb, [Compass](https://www.mongodb.com/download-center/compass) is a good tool.

Ensure you’re getting the latest version of MongoDB:


```
sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv EA312927
echo "deb http://repo.mongodb.org/apt/ubuntu xenial/mongodb-org/3.2 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-3.2.list
```

Check for updates: sudo apt-get update

Now that the MongoDB repository has been added, we’re ready to install the latest stable version of MongoDB:


```
sudo apt-get install mongodb-org
```

### **Configure OAuth**

As a part of the initial setup, a root user needs to be added to the system. In order to claim the root user, a oauth config file must be created in ./config/oauth.json (take a look at ./config/oauth.fallback.json for an example using the [Google OAuth 2.0 auth strategies](https://github.com/jaredhanson/passport-google-oauth2). To use the provided Google OAuth strategy, make sure to add an oauth application at the [Google developer console](https://console.developers.google.com/apis/credentials). More about [OAth2 here](https://developers.google.com/identity/protocols/OAuth2).

Note: The Google developer console can be a bit finnicky. If you get lost in there, ask someone who's been there before. Your mission is to locate the OAuth consent screen and:


*   Create OAuth 2.0 client IDs for a web application
*   You should add [http://127.0.0.1:4000](http://127.0.0.1:4000/) to "Authorized JavaScript origins"
*   Also add [http://127.0.0.1:4000/v1/auth/callback/google](http://127.0.0.1:4000/v1/auth/callback/google) to "Authorized redirect URIs"

If you want to use another strategy than Google OAuth 2.0, please refer to the [Passport.js wiki](https://github.com/jaredhanson/passport/wiki/Strategies).


### **Install Saga**

If you have not installed git, install that first. To get the latest version of Saga enter:


```
git clone https://github.com/VegaPublish/saga.git
```

From there you will execute the following commands:

```
cd /saga
Sudo npm install
```

Now set up your database:

```
mongodump -d saga-vega_documentation -o ./saga-vega_documentation
mongodump --out /path_of_your_backup/`date +"%m-%d-%y"`
```

**You must configure oauth before starting Saga.** Create oauth.json from oauth.fallback.json by pasting the Client ID and Secret ID created in Google Developer Console into the new file.

Now start Saga:

At the root prompt type: `root@yoursite:~/saga# npm run start`

(at # substitute your FQDN or IP address)

You should see the following if successful:

```
> saga@1.0.0 start /root/saga
> babel-node src/server.js | pino
```

Congratulations! You’ve installed Saga!

Before going on to the next step, you need to edit the defaultConfig.js file to prepare to run Vega.

CD to the saga install folder/src/config/ and then open defaultConfig.js with your favorite text editor. FDQN stands for “fully qualified domain name.”

----------------------------------------------

Under the first first mod host (commented out) add yours:

/*  hostname: process.env.SAGA_HTTP_HOST || '127.0.0.1',*/

  hostname: process.env.SAGA_HTTP_HOST || 'your FDQN here',

------------------------------------------------

Then add    

'http://yourFDQN:3333',

    	'YourFDQN',:

-----------------------------------------------------

	maxAge: int(process.env.SAGA_CORS_MAX_AGE, 600),

	origin: split(process.env.SAGA_CORS_ORIGINS) || [

    	'YourFDQN',

    	'YourFDQN',

    	'http://localhost:3333',

    	'http://127.0.0.1:3333',

    	'http://0.0.0.0:3333',

    	'http://localhost:1234',

    	'http://127.0.0.1:1234',

    	'http://0.0.0.0:1234',

    	'http://localhost:1235',

    	'http://127.0.0.1:1235',

    	'http://0.0.0.0:1235',

    	'http://localhost:1236',

    	'http://127.0.0.1:1236',

    	'[http://0.0.0.0:1236](http://0.0.0.0:1236)'


#### **Saga config options**

List of possible environment variables:


*   SAGA_HTTP_PORT: The port to run the backend on (default 4000)
*   SAGA_HTTP_HOST: Which HTTP host to run on: (default 127.0.0.1)
*   SAGA_LOG_LEVEL: The loglevel to use (passed on to pino which is used for logging) (default info)
*   SAGA_SESSION_NAME: Session name (default sagaSession)
*   SAGA_SESSION_SECRET: Session secret
*   SAGA_SESSION_TTL_MS: Session cookie TTL
*   SAGA_AUTH_PROVIDERS_CONFIG_PATH: Path to oauth provider config (default ./config/oauth.json)
*   SAGA_DATA_MAX_INPUT_BYTE: Payload size limit for posted data (default 2MB)
*   SAGA_ASSETS_MAX_INPUT_BYTE: Size limit for uploaded assets (default 15MB)
*   SAGA_ASSETS_FS_BASE_PATH: The base path of assets stored on disk (default ./data/assets/)
*   SAGA_CORS_MAX_AGE: Configures the Access-Control-Max-Age CORS header (default 600 ms)
*   SAGA_CORS_ORIGINS: A comma delimited string with all the allowed CORS origins.
*   SAGA_CORS_EXPOSED_HEADER: Configures the Access-Control-Expose-Headers CORS headers. This will be added in addition to Content-Type, Content-Length and ETag
*   SAGA_MONGODB_URL: URL to MongoDB instance (default mongodb://localhost:27017)
*   SAGA_BASE_URL : The base URL where Saga is publicly available, (default: 'http://localhost:4000')