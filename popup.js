// Listener para o clique no ícone da extensão na barra do Chrome
chrome.action.onClicked.addListener((tab) => {
  // Constrói a URL para a página HTML interna da extensão
  const pageUrl = chrome.runtime.getURL('index.html');

  // Abre a nossa página de busca em uma nova aba
  chrome.tabs.create({
    url: pageUrl
  });
});