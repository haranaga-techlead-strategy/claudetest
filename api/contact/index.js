/**
 * Azure Functions HTTP Trigger: Contact Form Handler
 *
 * エンドポイント: POST /api/contact
 *
 * メール送信を有効にするには:
 * 1. Azure Communication Services リソースを作成
 * 2. 環境変数 AZURE_COMMUNICATION_CONNECTION_STRING を設定
 * 3. 環境変数 CONTACT_RECIPIENT_EMAIL を設定
 * 4. @azure/communication-email パッケージを依存関係に追加:
 *    cd api && npm install @azure/communication-email
 * 5. 下記のコメントアウト部分を有効化
 */

// const { EmailClient } = require('@azure/communication-email');

module.exports = async function (context, req) {
  context.log('Contact form submission received');

  // CORS ヘッダー（必要に応じて許可オリジンを限定）
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  // OPTIONS プリフライトリクエストの処理
  if (req.method === 'OPTIONS') {
    context.res = { status: 204, headers };
    return;
  }

  if (req.method !== 'POST') {
    context.res = {
      status: 405,
      headers,
      body: { error: 'Method Not Allowed' }
    };
    return;
  }

  const body = req.body || {};
  const name    = (body.name    || '').trim();
  const email   = (body.email   || '').trim();
  const subject = (body.subject || '').trim();
  const message = (body.message || '').trim();

  // バリデーション
  const errors = {};
  if (!name)    errors.name    = 'お名前は必須です';
  if (!email) {
    errors.email = 'メールアドレスは必須です';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = '正しいメールアドレスを入力してください';
  }
  if (!message) errors.message = 'メッセージは必須です';

  if (Object.keys(errors).length > 0) {
    context.res = {
      status: 400,
      headers,
      body: { success: false, errors }
    };
    return;
  }

  // ---- Azure Communication Services でメール送信 ----
  // const connectionString = process.env.AZURE_COMMUNICATION_CONNECTION_STRING;
  // const recipientEmail   = process.env.CONTACT_RECIPIENT_EMAIL;
  //
  // if (connectionString && recipientEmail) {
  //   const emailClient = new EmailClient(connectionString);
  //   const poller = await emailClient.beginSend({
  //     senderAddress: 'DoNotReply@<your-domain>.azurecomm.net',
  //     recipients: { to: [{ address: recipientEmail }] },
  //     content: {
  //       subject: `[お問い合わせ] ${subject || '（件名なし）'}`,
  //       plainText: `お名前: ${name}\nメール: ${email}\n\n${message}`
  //     }
  //   });
  //   await poller.pollUntilDone();
  // }
  // ---------------------------------------------------

  context.log(`新規お問い合わせ: ${name} <${email}> - ${subject || '（件名なし）'}`);

  context.res = {
    status: 200,
    headers,
    body: {
      success: true,
      message: 'お問い合わせを受け付けました。近日中にご連絡いたします。'
    }
  };
};
