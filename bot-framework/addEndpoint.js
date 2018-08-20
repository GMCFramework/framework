/**
 * Set endpoint
 * @param {Object} router
 * @param {function} callback
 */
function addEndpoint(router, callback) {
  router.all('/', async (req, res) => {
    if (req.body.messages !== undefined) {
      console.log('Gem EndPoint');
      console.log(req.body.messages);
      for (let item of req.body.messages) {
        callback(item);
      }
    }
    res.send('ok');
  });
}

module.exports = addEndpoint;
