const get = async event => {
  console.log('Get Lambda event', event);
  return event;
};

module.exports = {
  get,
};
