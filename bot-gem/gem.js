const request = require('request');
const GemPipe = require('../bot-gem/gem.pipe');

let inited = false;
let pipeList = [];

let instance = null;

let first = true;

/**
 * Represents bot for Gems
 */
class GemBot {
  /**
   * Gem bot constructor
   * @param {string} url
   * @param {string} token
   * @param {string} endpoint
   * @param {boolean} debug
   */
  constructor(url, token, endpoint, debug = false) {
    if (instance) {
      return instance;
    }

    instance = this;

    this.url = url;
    this.token = token;
    this.endpoint = endpoint;
    this.session = null;
    this.debug = debug;
  }

  /**
   * initialize bot
   * @return {*|Promise}
   */
  init() {
    return new Promise((resolve) => {
      if (inited === true) {
        resolve();
        return;
      }
      inited = true;

      this.connectBot().then(() => {
        // this.polling();
        resolve();
      });
    });
  }

  /**
   * Get session by token
   * @return {Promise}
   */
  connectBot() {
    return new Promise((resolve) => {
      this._request('connectBot', {
        token: this.token,
        remoteUrl: this.endpoint,
      })
        .then((result) => {
          this.session = result.session;
          if (first) {
            if (this.debug) {
              console.debug('token: ' + this.token);
              console.debug(result);
            }
            first = false;
          }
          resolve();
          setTimeout(() => {
            this.connectBot().then();
          }, 60000 * 10);
        });
    });
  }

  /**
   * Add middleware function
   * @param {function} func
   */
  use(func) {
    pipeList.push(func);
  }

  /**
   * Start and continue polling
   */
  polling() {
    this._request('getMessages', {
      session: this.session,
      timestamp: new Date().getTime(),
    }).then(async (result) => {
      let currentTimestamp = result['timestamp'];
      if (result['messages'] !== undefined) {
        if (result.messages.length) {
          let i = 0;
          for (let item of result['messages']) {
            let done = () => {
              i++;
              if (i === result.messages.length) {
                this.confirmDelivery(currentTimestamp).then(() => {
                  this._nextPolling();
                });
              }
            };
            this.createPipe(item, done);
          }
        }
      } else {
        this._nextPolling();
      }
    }
    );
  }

  /**
   * Create pipe
   * @param {*} item
   * @param {function} done
   */
  createPipe(item, done) {
    let pipe = new GemPipe(this, pipeList, item, done);
    pipe.start();
  }

  /**
   * next polling step
   * @private
   */
  _nextPolling() {
    setTimeout(() => {
      this.polling();
    }, 500);
  }

  /**
   * Confirm delivery of messages
   * @param {Number} timestamp
   * @return {Promise}
   */
  confirmDelivery(timestamp) {
    return new Promise((resolve) => {
      this._request('confirmDelivery', {
        session: this.session,
        timestamp: timestamp,
      }).then(() => {
        resolve();
      });
    });
  }

  /**
   * Send messages
   * @param {String} receiver
   * @param {String} message
   * @param {Array} buttons
   * @param {Array} inline buttons
   * @return {Promise}
   */
  async sendMessage(receiver, message, buttons = [], inline = []) {
    let title = this.clearMarkdown(message);
    message = this.convertMessageFormat(message);
    if (this.session === null) {
      await this.connectBot();
    }
    return new Promise((resolve) => {
      let options = {
        session: this.session,
        receiverId: receiver,
      };
      if (buttons.length || inline.length) {
        options.messageType = 'SPECIAL_COMMANDS';
        let data = {
          title: message,
        };
        data.data = {};
        data.data.commands = [];
        for (let item of inline) {
          data.data.commands.push([item]);
        }
        for (let item of buttons) {
          data.data.commands.push(item);
        }
        data.data = JSON.stringify(data.data);
        options.message = JSON.stringify(data);
      } else {
        options.messageType = 'RichText';
        options.messageTitle = title;
        options.message = JSON.stringify({
          Entries: [],
          Text: message,
        });
      }

      this._request('sendMessage', options).then(() => {
        resolve();
      });
    });
  }

  /**
   * Send photo
   * @param {number} receiver
   * @param {string} urlImage
   * @return {Promise}
   */
  sendPhoto(receiver, urlImage) {
    return new Promise((resolve) => {
      let options = {
        session: this.session,
        receiverId: receiver,
        messageType: 'UpdatedImage',
        message: JSON.stringify({
          Comment: '',
          FileName: '',
          LocalUrl: '',
          RemoteThumbnailUrl: '',
          duration: 0,
          remoteSerialization: true,
          UploadResponce: {
            responce: {
              fileName: 'image',
              url: urlImage,
              mimetype: 'image/png',
            },
          },
        }),
      };

      this._request('sendMessage', options).then(() => {
        resolve();
      });
    });
  }

  /**
   * Request to gem server
   * @param {string} address
   * @param {object} params
   * @return {Promise <object>}
   * @private
   */
  async _request(address, params) {
    return new Promise((resolve) => {
      let options = {
        uri: this.url + address,
        method: 'POST',
        json: params,
        headers: {
          'Content-Type': 'application/json',
        },
      };
      try {
        request(options, (error, response, body) => {
          if (this.debug) {
            console.debug('Gem request');
            console.debug('options', options);
            console.debug('body', body);
          }
          if (body !== undefined &&
            body.error !== undefined &&
            body.error.message !== undefined &&
            body.error.message === 'E_SESSION_EXPIRED') {
            this.connectBot().then(() => {
              params.session = this.session;
              this._request(address, params).then((body) => {
                resolve(body);
              });
            });
          } else {
            resolve(body);
          }
        });
      } catch (e) {
        setTimeout(() => {
          resolve(this._request(address, params));
        }, 5000);
      }
    });
  }

  /**
   * Format message format from telegram to gem
   * @param {string} message
   * @return {string}
   */
  convertMessageFormat(message) {
    message = message.replace(/\\\*/g, '*');
    for (let i = 0; i < message.length; i++) {
      if (message[i] === '*') {
        if (i > 0 && message[i - 1] === '*') {
          continue;
        }
        if (i < (message.length - 1) && message[i + 1] === '*') {
          continue;
        }
        message = message.substring(0, i) + '*' + message.substring(i);
      }
    }

    message = message.replace(/_/g, '*');

    return message;
  }

  /**
   * Clear markdown from message
   * @param {string} message
   * @return {string}
   */
  clearMarkdown(message) {
    message = message.replace(/(?:_|[*#])|\[(.*?)\]\(.*?\)/gm, '$1');
    return message;
  }
}

module.exports = GemBot;
