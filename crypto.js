// Cofre criptografado: a senha nunca é salva — ela deriva (via PBKDF2) uma
// chave AES-GCM que criptografa o blob de dados inteiro no localStorage.
// Sem a senha certa, o AES-GCM falha na autenticação e a descriptografia
// dá erro (não existe "quase certo" — ou abre, ou não abre).
// Não existe recuperação de senha: perder a senha é perder os dados.

const VAULT_STORAGE_KEY = 'documentos-app-vault-v1';
const PBKDF2_ITERATIONS = 250000;

function bufToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToBuf(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function deriveKey(password, saltBuf) {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: saltBuf, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encryptJSON(key, obj) {
  const enc = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = enc.encode(JSON.stringify(obj));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
  return { iv: bufToBase64(iv), ciphertext: bufToBase64(ciphertext) };
}

async function decryptJSON(key, ivB64, ciphertextB64) {
  const iv = new Uint8Array(base64ToBuf(ivB64));
  const ciphertext = base64ToBuf(ciphertextB64);
  const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  return JSON.parse(new TextDecoder().decode(plainBuf));
}

function readVaultRecord() {
  try {
    const raw = localStorage.getItem(VAULT_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function writeVaultRecord(record) {
  try {
    localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(record));
    return true;
  } catch (e) {
    return false;
  }
}

function vaultExists() {
  const rec = readVaultRecord();
  return !!(rec && rec.salt && rec.iv && rec.ciphertext);
}

async function criarCofre(password, dadosIniciais) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(password, salt);
  const { iv, ciphertext } = await encryptJSON(key, dadosIniciais);
  const ok = writeVaultRecord({ salt: bufToBase64(salt), iv, ciphertext, v: 1 });
  if (!ok) throw new Error('STORAGE_WRITE_FAILED');
  return key;
}

// Lança erro se a senha estiver errada (falha de autenticação do AES-GCM).
async function desbloquearCofre(password) {
  const rec = readVaultRecord();
  if (!rec) throw new Error('Nenhum cofre encontrado.');
  const salt = base64ToBuf(rec.salt);
  const key = await deriveKey(password, salt);
  const dados = await decryptJSON(key, rec.iv, rec.ciphertext);
  return { key, dados };
}

async function salvarCofre(key, dados) {
  const { iv, ciphertext } = await encryptJSON(key, dados);
  const rec = readVaultRecord() || {};
  return writeVaultRecord({ ...rec, iv, ciphertext, v: 1 });
}

function resetarCofre() {
  try {
    localStorage.removeItem(VAULT_STORAGE_KEY);
    return true;
  } catch (e) {
    return false;
  }
}

function cryptoDisponivel() {
  return !!(window.crypto && window.crypto.subtle);
}
