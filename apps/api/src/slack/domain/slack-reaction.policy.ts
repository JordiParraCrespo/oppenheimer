/**
 * Slack's names for the emoji a bot reacts with. `reactions.add` takes a
 * name, never the character, and the API carries no emoji catalog, so this
 * is the set a bot can react with on Slack: the console's quick reactions,
 * the ones the tool suggests, and the usual workplace replies. A character
 * outside it has no name here, and the bot is told to pick another.
 */
const SLACK_REACTION_NAMES: Readonly<Record<string, string>> = {
  '👍': '+1',
  '👎': '-1',
  '❤': 'heart',
  '😂': 'joy',
  '😮': 'open_mouth',
  '😢': 'cry',
  '🙏': 'pray',
  '🎉': 'tada',
  '👀': 'eyes',
  '✅': 'white_check_mark',
  '✔': 'heavy_check_mark',
  '☑': 'ballot_box_with_check',
  '❌': 'x',
  '🔥': 'fire',
  '💯': '100',
  '👏': 'clap',
  '🙌': 'raised_hands',
  '👌': 'ok_hand',
  '✌': 'v',
  '🤞': 'crossed_fingers',
  '💪': 'muscle',
  '👋': 'wave',
  '🤝': 'handshake',
  '🫡': 'saluting_face',
  '🤦': 'facepalm',
  '🤷': 'shrug',
  '😀': 'grinning',
  '😃': 'smiley',
  '😄': 'smile',
  '😁': 'grin',
  '😆': 'laughing',
  '😅': 'sweat_smile',
  '🤣': 'rolling_on_the_floor_laughing',
  '😊': 'blush',
  '🙂': 'slightly_smiling_face',
  '🙃': 'upside_down_face',
  '😉': 'wink',
  '😇': 'innocent',
  '😍': 'heart_eyes',
  '🥰': 'smiling_face_with_3_hearts',
  '😘': 'kissing_heart',
  '🤩': 'star-struck',
  '🥳': 'partying_face',
  '😎': 'sunglasses',
  '🤓': 'nerd_face',
  '🤔': 'thinking_face',
  '🤗': 'hugging_face',
  '😏': 'smirk',
  '😐': 'neutral_face',
  '😑': 'expressionless',
  '😒': 'unamused',
  '🙄': 'face_with_rolling_eyes',
  '😬': 'grimacing',
  '😳': 'flushed',
  '🥺': 'pleading_face',
  '😱': 'scream',
  '😭': 'sob',
  '😤': 'triumph',
  '😡': 'rage',
  '🤯': 'exploding_head',
  '😴': 'sleeping',
  '🙈': 'see_no_evil',
  '💀': 'skull',
  '🤖': 'robot_face',
  '💙': 'blue_heart',
  '💚': 'green_heart',
  '💛': 'yellow_heart',
  '🧡': 'orange_heart',
  '💜': 'purple_heart',
  '🖤': 'black_heart',
  '🤍': 'white_heart',
  '💔': 'broken_heart',
  '🚀': 'rocket',
  '⭐': 'star',
  '🌟': 'star2',
  '✨': 'sparkles',
  '💡': 'bulb',
  '📌': 'pushpin',
  '📝': 'memo',
  '⏳': 'hourglass_flowing_sand',
  '⌛': 'hourglass',
  '⏰': 'alarm_clock',
  '🐛': 'bug',
  '🔧': 'wrench',
  '⚠': 'warning',
  '❗': 'exclamation',
  '❓': 'question',
  '💬': 'speech_balloon',
  '🏆': 'trophy',
  '🥇': 'first_place_medal',
  '👑': 'crown',
  '🎂': 'birthday',
  '🎁': 'gift',
  '☕': 'coffee',
  '🍕': 'pizza',
  '🍻': 'beers',
  '☀': 'sunny',
  '🌈': 'rainbow',
  '🦄': 'unicorn_face',
  '🚫': 'no_entry_sign',
  '⛔': 'no_entry',
  '➕': 'heavy_plus_sign',
  '➖': 'heavy_minus_sign',
  '🟢': 'large_green_circle',
  '🟡': 'large_yellow_circle',
  '🔴': 'red_circle',
};

/** Slack's `skin-tone-2` to `skin-tone-6`, by the modifier that follows the hand or face. */
const SKIN_TONES: Readonly<Record<string, number>> = {
  '🏻': 2,
  '🏼': 3,
  '🏽': 4,
  '🏾': 5,
  '🏿': 6,
};

/**
 * The name Slack reacts with for one emoji (`👍` is `+1`, `👍🏽` is
 * `+1::skin-tone-4`), with or without its emoji presentation selector; null
 * for one this table has no name for.
 */
export function slackReactionName(emoji: string): string | null {
  const plain = emoji.replaceAll('️', '');
  const direct = SLACK_REACTION_NAMES[plain];
  if (direct) return direct;
  const chars = [...plain];
  const tone = chars.length === 2 ? SKIN_TONES[chars[1] ?? ''] : undefined;
  const base = tone ? SLACK_REACTION_NAMES[chars[0] ?? ''] : undefined;
  return base && tone ? `${base}::skin-tone-${tone}` : null;
}
