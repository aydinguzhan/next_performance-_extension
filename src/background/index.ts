chrome.runtime.onInstalled.addListener(() => {
  console.log("Chrome extension installed.");
});

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;

  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      console.log("Action button clicked.");

    },
  });
  
});
