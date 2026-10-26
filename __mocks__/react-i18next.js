const React = require('react');
const reactI18next = require('react-i18next');

const hasChildren = (node) => node && (node.children || (node.props && node.props.children));

const getChildren = (node) => (node && node.children ? node.children : node.props && node.props.children);

const renderNodes = (reactNodes) => {
  if (typeof reactNodes === 'string') {
    return reactNodes;
  }

  return Object.keys(reactNodes).map((key, i) => {
    const child = reactNodes[key];
    const isElement = React.isValidElement(child);

    if (typeof child === 'string') {
      return child;
    }
    if (hasChildren(child)) {
      const inner = renderNodes(getChildren(child));
      return React.cloneElement(child, { ...child.props, key: i }, inner);
    }
    if (typeof child === 'object' && !isElement) {
      return Object.keys(child).reduce((str, childKey) => `${str}${child[childKey]}`, '');
    }

    return child;
  });
};

const useMock = [(k) => k, {}];
useMock.t = (k, o, values = {}) =>
  Object.entries(values).reduce(
    (text, [name, value]) => text.replace(new RegExp(`{{${name}}}`, 'g'), () => String(value)),
    (o && o.defaultValue) || (typeof o === 'string' ? o : k),
  );
useMock.i18n = {};

module.exports = {
  // this mock makes sure any components using the translate HoC receive the t function as a prop
  Trans: ({ children, t, i18nKey, defaults, values, components }) => {
    if (!defaults) {
      return renderNodes(children);
    }
    const text = (t || useMock.t)(i18nKey, defaults, values);
    const parts = [];
    const tag = /<(\w+)>(.*?)<\/\1>/g;
    let last = 0;
    let match;
    while ((match = tag.exec(text))) {
      parts.push(
        text.slice(last, match.index),
        React.cloneElement(components[match[1]], { key: match.index }, match[2]),
      );
      last = tag.lastIndex;
    }
    return React.createElement(React.Fragment, null, ...parts, text.slice(last));
  },
  Translation: ({ children }) => children((k) => k, { i18n: {} }),
  useTranslation: () => useMock,

  // mock if needed
  I18nextProvider: reactI18next.I18nextProvider,
  initReactI18next: reactI18next.initReactI18next,
  setDefaults: reactI18next.setDefaults,
  getDefaults: reactI18next.getDefaults,
  setI18n: reactI18next.setI18n,
  getI18n: reactI18next.getI18n,
};
