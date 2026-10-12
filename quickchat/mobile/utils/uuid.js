let counter = 0;

export function createClientMessageId() {
  counter = (counter + 1) % 1000000;

  const time = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  const seq = counter.toString(36);

  return `m_${time}_${rand}_${seq}`;
}
