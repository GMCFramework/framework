/**
 * Represents gem pipe
 */
class GemPipe {
  /**
   * GemPipe constructor
   * @param {GemBot} GemBot
   * @param {Array<Function>} pipe
   * @param {Object} request
   * @param {Function} done
   */
  constructor(GemBot, pipe, request, done) {
    this.pipe = pipe.slice(0);
    this.request = request;
    this.done = done;
    this.GemBot = GemBot;
    this.addContext();
  }

  /**
   * start pipe work
   */
  start() {
    this.next().then(() => {
      this.end();
    });
  }

  /**
   * Call next function in pipe
   * @return {*}
   */
  next() {
    if (this.pipe.length !== 0) {
      let func = this.pipe.shift();
      return func(this.request, () => {
        return this.next();
      });
    } else {
      return new Promise((resolve) => {
        resolve();
      });
    }
  }

  /**
   * addContest to request
   */
  addContext() {
    this.request.reply = (message, buttons, inline) => {
      return this.reply(message, buttons, inline);
    };
    this.request.replyWithPhoto = (url) => {
      return this.replyWithPhoto(url);
    };
  }

  /**
   * Send reply message
   * @param {String} message
   * @param {Array} buttons
   * @param {Array} inline buttons
   * @return {Promise}
   */
  reply(message, buttons, inline) {
    return this.GemBot.sendMessage(this.request['senderId'],
      message,
      buttons,
      inline);
  }

  /**
   * Replay with photo
   * @param {String} url
   * @return {Promise}
   */
  replyWithPhoto(url) {
    return this.GemBot.sendPhoto(this.request['senderId'], url);
  }

  /**
   * finish thread
   */
  end() {
    this.done(this.request);
  }
}

module.exports = GemPipe;
