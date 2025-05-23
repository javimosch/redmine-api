import config from '../config/config.js';

/**
 * Emoji utility module for providing emoji support in the CLI
 */

// Map of emoji aliases to unicode characters
const emojiMap = {
  // Status related
  success: '✅',
  error: '❌',
  warning: '⚠️',
  info: '📝',
  debug: '🔍',
  loading: '⏳',
  done: '✅',
  
  // Action related
  fetch: '🔄',
  search: '🔎',
  save: '💾',
  edit: '✏️',
  delete: '🗑️',
  exit: '👋',
  help: '❓',
  settings: '⚙️',

  // Redmine specific
  issue: '🎫',
  project: '📁',
  user: '👤',
  time: '⏱️',
  priority: {
    low: '🟢',
    normal: '🟡',
    high: '🟠',
    urgent: '🔴',
    immediate: '⚫'
  },
  status: {
    new: '🆕',
    inProgress: '🚧',
    resolved: '✓',
    closed: '🔒',
    feedback: '💬',
    rejected: '❌'
  }
};

/**
 * Get an emoji by its alias
 * @param {string} alias - The emoji alias
 * @param {boolean} fallback - Whether to return the alias if emoji is disabled or not found
 * @returns {string} The emoji character or alias (if fallback is true)
 */
export const getEmoji = (alias, fallback = true) => {
  // If emoji is disabled, return the alias or empty string
  if (!config.ui.enableEmoji) {
    return fallback ? alias : '';
  }

  // Handle nested objects in emojiMap (like priority.low)
  if (alias.includes('.')) {
    const [category, subType] = alias.split('.');
    if (emojiMap[category] && emojiMap[category][subType]) {
      return emojiMap[category][subType];
    }
  }

  // Return the emoji if it exists, otherwise return the alias or empty string
  return emojiMap[alias] || (fallback ? alias : '');
};

/**
 * Formats a text with emoji prefix
 * @param {string} text - The text to format
 * @param {string} emojiAlias - The emoji alias to prefix
 * @returns {string} Formatted text with emoji
 */
export const formatWithEmoji = (text, emojiAlias) => {
  const emoji = getEmoji(emojiAlias, false);
  return emoji ? `${emoji}  ${text}` : text;
};

export default {
  getEmoji,
  formatWithEmoji
};
