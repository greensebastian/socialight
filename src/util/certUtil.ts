import { existsSync, readFileSync } from 'fs';
import { createSecureContext } from 'tls';

const tryReadFile = (path: string | undefined) => {
  if (!path || !existsSync(path)) return undefined;
  return readFileSync(path, 'utf8');
};

const getCertInfo = () => {
  const privateKey = tryReadFile(process.env.TLS_PRIVKEY);
  const certificate = tryReadFile(process.env.TLS_CERT);

  return privateKey && privateKey.length && certificate && certificate.length
    ? {
      privateKey,
      certificate,
    }
    : undefined;
};

const createSecureCtx = () => {
  const certInfo = getCertInfo();
  if (!certInfo) return undefined;

  const ctx = createSecureContext({
    key: certInfo.privateKey,
    cert: certInfo.certificate,
  });

  return ctx;
};

const setupSecureCtx = () => {
  let ctx = createSecureCtx();

  setInterval(() => {
    ctx = createSecureCtx();
  }, 1000 * 60 * 60);

  return () => ctx;
};

export default setupSecureCtx;
