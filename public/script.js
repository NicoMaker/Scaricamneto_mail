
function setImapServer(sel) {
  const imapInput = document.getElementById('imap_server');
  switch (sel.value) {
    case 'gmail':
      imapInput.value = 'imap.gmail.com';
      imapInput.readOnly = true;
      break;
    case 'outlook':
      imapInput.value = 'outlook.office365.com';
      imapInput.readOnly = true;
      break;
    case 'yahoo':
      imapInput.value = 'imap.mail.yahoo.com';
      imapInput.readOnly = true;
      break;
    case 'altro':
      imapInput.value = '';
      imapInput.readOnly = false;
      imapInput.focus();
      break;
  }
}
window.onload = () => {
  setImapServer(document.getElementById('provider'));
};
