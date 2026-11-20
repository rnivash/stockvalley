const DATABASE_NAME = 'stockvalley';
const DATABASE_VERSION = 1;
const STORE_NAME = 'appData';

let databasePromise;

const openDatabase = () => {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB is not available in this browser.'));
  }

  if (!databasePromise) {
    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(STORE_NAME)) {
          database.createObjectStore(STORE_NAME, { keyPath: 'key' });
        }
      };
      request.onsuccess = () => {
        const database = request.result;
        database.onversionchange = () => database.close();
        resolve(database);
      };
      request.onerror = () => {
        databasePromise = undefined;
        reject(request.error || new Error('Could not open the IndexedDB database.'));
      };
      request.onblocked = () => {
        databasePromise = undefined;
        reject(new Error('IndexedDB is blocked by another open connection.'));
      };
    });
  }

  return databasePromise;
};

const rejectOnTransactionError = (transaction, reject) => {
  let settled = false;
  const fail = () => {
    if (settled) return;
    settled = true;
    reject(transaction.error || new Error('The IndexedDB transaction failed.'));
  };
  transaction.onerror = fail;
  transaction.onabort = fail;
  return () => {
    settled = true;
  };
};

export async function loadData(keys) {
  const database = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const finish = rejectOnTransactionError(transaction, reject);
    const values = {};
    const store = transaction.objectStore(STORE_NAME);

    keys.forEach((key) => {
      const request = store.get(key);
      request.onsuccess = () => {
        if (request.result !== undefined) {
          values[key] = request.result.value;
        }
      };
    });

    transaction.oncomplete = () => {
      finish();
      resolve(values);
    };
  });
}

export async function saveData(key, value) {
  const database = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const finish = rejectOnTransactionError(transaction, reject);
    transaction.objectStore(STORE_NAME).put({ key, value });
    transaction.oncomplete = () => {
      finish();
      resolve();
    };
  });
}
