// PayPal SDK type declaration
export {};

declare global {
  interface Window {
    paypal?: {
      Buttons: (config: any) => {
        render: (selector: string) => void;
      };
      createInstance: (options: any) => Promise<any>;
    };
  }
}

async function initPayPal() {
  const sdkInstance = await window.paypal!.createInstance({
    clientId: "AbYS_oR6J0qO_epWRgxDJpMGOwBCGbvZ9UaePb8FTgQmx9Dnlakd0ajMZV119iLyEx3gsjYuiTK1uP-N",
    components: ["paypal-payments"],
  });
  return sdkInstance;
}

initPayPal();