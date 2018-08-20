const Telegraf = require('telegraf');
const Markup = Telegraf.Markup;
const Extra = Telegraf.Extra;
const Gem = require('../bot-gem/gem');
const addEndpoint = require('./addEndpoint');

/**
 * class for mapping Telegram/Gem bots
 */
class BotFramework {
  constructor(botsSettings){
    this.botTelegram = new Telegraf(botsSettings.telegram.token);
    if (botsSettings.telegram.getUser !== undefined) {
      this.telegramGetUser = botsSettings.telegram.getUser;
    }
    if (botsSettings.gem.getUser !== undefined) {
      this.gemGetUser = botsSettings.gem.getUser;
    }
    this.botGem = new Gem(botsSettings.gem.url, botsSettings.gem.token, botsSettings.endpoint);
  } 
  /**
   * Add function to bot use
   * @param {Object} func
   */
  use(func) {
    this.botTelegram.use((context, next) => {
      return this._mapTelegram(context, next, func);
    });

    this.botGem.use((context, next) => {
      return this._mapGem(context, next, func);
    });
  }

   /**
   * Send message to user;
   * @param {String} message
   * @param {Object} ids
   * @param {String} platform
   */
  sendMessage(message, ids, platform = 'all') {
    // TODO: Put send message into framework interface
    let needTelegram = false;
    let needGem = false;
    switch (platform) {
      case 'all':
        needTelegram = true;
        needGem = true;
        break;
      case 'telegram':
        needTelegram = true;
        break;
      case 'gem':
        needGem = true;
        break;
    }
    if (needTelegram && ids.telegramId) {
      this.botTelegram.telegram.sendMessage(ids.telegramId, message, {
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
      }).catch(function(e) {
      });
    }
    if (needGem && ids.gemId) {
      this.botGem.sendMessage(ids.gemId, message);
    }
  }

   /**
   * Send photo to user
   * @param {Object} ids
   * @param {String} url
   */
  sendPhoto(url) {
    if (ids.telegramId) {
      this.botTelegram.telegram.sendPhoto(ids.telegramId, url);
    }
    if (ids.gemId) {
      this.botGem.sendPhoto(ids.gemId, url);
    }
  }

 

  /**
   * Mapping telegram context
   * @param {Object} context
   * @param {Function} next
   * @param {Object} func
   * @return {Promise}
   * @private
   */
  async _mapTelegram(context, next, func) {
    let obj = {};
    switch (context.updateType) {
      case 'message':
        if (context.updateSubTypes[0] === 'contact') {
          obj.type = 'contact';
          obj.contact = context.update.message.contact;
          obj.from = context.update.message.from.id;
        } else {
          obj.type = 'text';
          obj.subtype = 'text';
          obj.text = context.update.message.text;
          obj.from = context.update.message.from.id;
        }
        break;
      case 'callback_query':
        obj.type = 'text';
        obj.subtype = 'action';
        obj.text = context.update.callback_query.data;
        obj.action = context.update.callback_query.data;
        obj.from = context.update.callback_query.from.id;
        break;
      default:
        return next();
    }
    obj.platform = 'telegram';
    if (this.telegramGetUser !== undefined) {
      obj.user = await this.telegramGetUser(obj.from);
    }
    this._addTelegramContext(context, obj);
    return func.use(obj, next);
  }


  /**
   * Add methods mapping for telegram
   * @param {Object} context
   * @param {Object} object
   * @private
   */
  _addTelegramContext(context, object) {
    object.reply = (message, buttons = [], inline = []) => {
      if (inline.length > 0) {
        return context.replyWithMarkdown(message, this._telegramInline(inline));
      } else if (buttons.length > 0) {
        return context.replyWithMarkdown(message, this._telegramButtons(buttons));
      } else {
        return context.replyWithMarkdown(message, {
          reply_markup: {
            remove_keyboard: true,
          },
          disable_web_page_preview: true,
        });
      }
    };
    object.replyWithPhoto = (url, buttons = []) => {
      return context.replyWithPhoto(url, this._telegramButtons(buttons));
    };
    object.replyWithChatAction = (action) => {
      return context.replyWithChatAction(action);
    };
    object.requestContact = (text, buttonText) => {
      return context.reply(text, {
        reply_markup: {
          one_time_keyboard: true,
          resize_keyboard: true,
          keyboard: [[
            {
              request_contact: true,
              text: buttonText,
            }]],
        },
      });
    };
  }

  /**
   * Format buttons for telegram
   * @param {Array} buttons
   * @return {{reply_markup}|*}
   * @private
   */
  _telegramButtons(buttons) {
    buttons = this.reArrayButtons(buttons);
    return Markup
      .keyboard(buttons)
      .resize()
      .extra();
  }

  /**
   * Get telegram inline
   * @param {Array<{title: String, id: String}>} inline
   * @return {Function}
   * @private
   */
  _telegramInline(inline) {
    return Extra.markdown().markup((m) => {
      let ret = [];
      for (let item of inline) {
        ret.push([m.callbackButton(item.title, item.id)]);
      }
      return m.inlineKeyboard(ret);
    });
  }

  /**
   * Mapping gem context
   * @param {Object} context
   * @param {Function} next
   * @param {Object} func
   * @return {Promise}
   * @private
   */
  async _mapGem(context, next, func) {
    let obj = {};
    switch (context.messageType) {
      case 'RichText':
        obj.type = 'text';
        obj.subtype = 'text';
        obj.text = JSON.parse(context.message)['Text'];
        if (obj.text.substring(0, 1) === '/') {
          obj.text = obj.text.substring(1);
        }
        break;
      case 'SPECIAL_RESULT_COMMAND':
        obj.type = 'text';
        obj.subtype = 'action';
        let data = JSON.parse(JSON.parse(context.message).data);
        obj.rawText = data.result;
        obj.action = data.result;
        obj.text = data.result;
        break;
      default:
        return next();
    }
    obj.platform = 'gem';
    if (this.gemGetUser !== undefined) {
      obj.user = await this.gemGetUser(context['senderId']);
    }
    this._addGemContext(context, obj);
    return func.use(obj, next);
  }

  /**
   * Add function mapping to Gem
   * @param {Object} context
   * @param {Object} object
   * @private
   */
  _addGemContext(context, object) {
    object.reply = (message, buttons = [], inline = []) => {
      return context.reply(message, this._gemButtons(buttons), this._gemInline(inline));
    };
    object.replyWithPhoto = (url) => {
      return context.replyWithPhoto(url);
    };
    object.replyWithChatAction = (action) => {
    };
  }

  /**
   * Format buttons for gem
   * @param {Array} buttons
   * @return {{reply_markup}|*}
   * @private
   */
  _gemButtons(buttons) {
    if (buttons.length === 0) {
      return buttons;
    }
    buttons = this.reArrayButtons(buttons);
    for (let line in buttons) {
      if (buttons.hasOwnProperty(line)) {
        for (let button in buttons[line]) {
          if (buttons[line].hasOwnProperty(button)) {
            buttons[line][button] = {
              id: buttons[line][button],
              title: buttons[line][button],
            };
          }
        }
      }
    }
    return buttons;
  }

  /**
   * Format inline buttons for Gem
   * @param {Array} inline
   * @return {*}
   * @private
   */
  _gemInline(inline) {
    return inline;
  }

  /**
   * Rearrange buttons
   * @param {Array} buttons
   * @return {Array}
   */
  reArrayButtons(buttons) {
    if (buttons.length === 0) {
      return buttons;
    }
    if (Array.isArray(buttons[0])) {
      return buttons;
    }
    if (buttons.length > 2) {
      let but = [];
      let item = [];
      for (let button of buttons) {
        item.push(button);
        if (item.length === 2) {
          but.push(item);
          item = [];
        }
      }
      but.push(item);
      buttons = but;
    } else {
      return [buttons];
    }
    return buttons;
  }

  /**
   * Start polling
   */
  start() {
    this.botTelegram.startPolling();
    this.botGem.init();
  }

  setEndPoint(router){
    return addEndpoint(router, (item) => {
      let done = () => {
      };
      this.botGem.createPipe(item, done);
    })
  }
}

module.exports = BotFramework;
