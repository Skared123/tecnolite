const express = require("express");
const axios = require("axios");
const admin = require("firebase-admin");
const { CloudTasksClient } = require("@google-cloud/tasks").v2;
const path = require("path");
const serviceAccount = require("./firebase/dev_service_account.json");

const app = express();
const port = 8080;

const apiKey = "povnHJRYuDufMP5i1vJnYNREAShWXgeS";
const apiUrl =
  "https://tecnolite-preprod.apimanagement.us3.hana.ondemand.com:443/pro/v1/tecnoliteb2c/products/list";

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.get("/Adquiriendo", async (req, res) => {
  try {
    const productList = await productsList();
    res.send(productList);
  } catch (error) {
    console.error("Error al obtener la lista de productos:", error.message);
    res.status(500).send("Error interno del servidor");
  }
});

app.post("/Add", async (req, res) => {
  const response = await AddQueue(1);
  res.send(response);
});

const productsList = async () => {
  try {
    //Sacando los productos
    const response = await axios.get(apiUrl, {
      headers: {
        ApiKey: apiKey,
      },
    });

    //Poner en una constante todos los productos
    const allProducts =
      response.data["ZB2C_MAESTROMATERIALES.Response"]["TMAESTRO_MATERIALES"]
        .item;

    //Aca los filtro para ver cuales estan disponibles y cuales no
    const availableProducts = allProducts.filter((product) =>
      ["Y4  ", "Y3", "Z3"].includes(product.MSTAE)
    );
    const unavailableProducts = allProducts.filter(
      (product) => !["Y4", "Y3", "Z3"].includes(product.MSTAE)
    );

    //Los retorno separados para ver cuales estan disponibles y cuales no
    return { available: availableProducts, unavailable: unavailableProducts };
  } catch (error) {
    // Manejo de errores, puedes personalizar según tus necesidades
    console.error("Error al realizar la solicitud:", error.message);
    throw new Error("Error al obtener la lista de productos");
  }
};

//Configuracion para meter la info a las colas

const options = {
  keyFilename: path.resolve(__dirname, "./firebase/dev_service_account.json"),
  projectId: "voltz-develop",
};

const tasksClient = new CloudTasksClient(options);
const project = "voltz-develop";
const queue = "tecnolite-api";
const location = "us-central1";
const parent = tasksClient.queuePath(project, location, queue);

const AddQueue = async (product_id) => {
  try {
    const task = {
      httpRequest: {
        httpMethod: "POST",
        url: "https://sync-shopify-2eozqchgjq-uc.a.run.app/sync/" + product_id,
      },
    };
    const request = {
      parent: parent,
      task: task,
    };
    const [response] = await tasksClient.createTask(request);
    const name = response.name;
    return name;
  } catch (error) {
    console.error("Can't create task", product_id, error);
  }
};

const getPriceStock = async (material_id) => {
  try {
    let data = JSON.stringify({
      ZB2C_PRECIO_STOCK: {
        CLIENTE: "12696",
      },
      MATERIALES: [
        {
          MATERIAL: material_id,
        },
      ],
    });
    let config = {
      method: "post",
      maxBodyLength: Infinity,
      url: "https://tecnolite-preprod.apimanagement.us3.hana.ondemand.com/pro/v1/tecnoliteb2c/products/precio_stock",
      headers: {
        ApiKey: "povnHJRYuDufMP5i1vJnYNREAShWXgeS",
        "Content-Type": "application/json",
        Cookie:
          "JTENANTSESSIONID_h9bacc559=QVNK5Cb4TZs%2BQPR%2BM7PX3fSrwKZYtTnL6TcGC3ILY7o%3D; BIGipServerl251178iflmapavtus3cpip.factoryus3.customdomain=!odWksTojTJTBaJlBONScn9j6LFNIL1jHm9o/v+fsiRXJCyzNhxIgk/fX+5UGe3R12Q9CrSj84IYn3iY=",
      },
      data: data,
    };
    const response = await axios(config);
    const listaMateriales =
      response.data["ZB2C_PRECIO_STOCK.Response"]["LISTA_MATERIALES"]["item"];
    const material = listaMateriales["MATERIAL"];
    const fechaLlegada = listaMateriales["FECHA_LLEGADA"];
    const stockTransito = listaMateriales["STOCK_TRANSITO"];
    const stockDisponible = listaMateriales["STOCK_DISPONIBLE"];
    const precioNeto = listaMateriales["PRECIO_NETO"];
    const moneda = listaMateriales["MONEDA"];
    return {
      material,
      fechaLlegada,
      stockTransito,
      stockDisponible,
      precioNeto,
      moneda,
    };
  } catch (error) {}
};

const getExtendedData = async (material_id) => {
  try {
    apiUrlExtendedData =
      "https://tecnolite-preprod.apimanagement.us3.hana.ondemand.com:443/pro/v1/tecnoliteb2c/products/" +
      material_id;
    const response = await axios.get(apiUrlExtendedData, {
      headers: {
        apiKey: apiKey,
      },
    });
    return response.data;
  } catch (error) {
    console.log(error);
  }
};

const getDataFromFirebaseBySku = async (sku) => {
  try {
    const snapshot = await db
      .collection("products")
      .where("sku", "==", sku)
      .get();

    const products = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      const product = {
        sku: data.sku,
        best_supplier: data.best_supplier,
      };
      products.push(product);
    });
    return products;
  } catch (error) {
    console.error("Error al obtener productos por SKU:", error);
    throw error;
  }
};

const comparisionEach = async (viejo, nuevo) => {
  if (viejo === "0000-00-00") {
    viejo = null;
  }
  if (nuevo === "0000-00-00") {
    nuevo = null;
  }
  const resultado = viejo == nuevo;
  return resultado;
};

const comparisionPrices = async (skuViejo, skuNuevo) => {
  const {
    arrive_date: arrive_dateViejo,
    currency: currencyViejo,
    price_best: price_bestViejo,
    stock: stockViejo,
    stock_transit: stock_transitViejo,
  } = skuViejo;
  const {
    fechaLlegada: arrive_dateNuevo,
    moneda: currencyNuevo,
    precioNeto: price_bestNuevo,
    stockDisponible: stockNuevo,
    stockTransito: stock_transitNuevo,
  } = skuNuevo;

  const result = [
    await comparisionEach(arrive_dateViejo, arrive_dateNuevo),
    await comparisionEach(currencyViejo, currencyNuevo),
    await comparisionEach(price_bestViejo, price_bestNuevo),
    await comparisionEach(stockViejo, stockNuevo),
    await comparisionEach(stock_transitViejo, stock_transitNuevo),
  ];
  if (result.every((result) => result)) {
    return true;
  } else {
    return false;
  }
};

app.get("/sync/:id", async (req, res) => {
  try {
    const skuId = req.params.id;
    //Aqui ya tengo el best_suplier viejo
    const skuu = await getDataFromFirebaseBySku(skuId);
    const dataPriceStock = await getPriceStock(skuId);
    const comparision = await comparisionPrices(
      skuu[0].best_supplier,
      dataPriceStock
    );

    const {
      exchange_rate,
      product_id,
      sku,
      source,
      supplier_code,
      supplier_name,
    } = skuu[0].best_supplier;
    const {
      fechaLlegada,
      moneda,
      precioNeto,
      stockDisponible,
      stockTransito,
    } = dataPriceStock;

    if (comparision) {
      console.log("Synchronized");
    } else {
      const resultObject = {
        exchange_rate,
        product_id,
        sku,
        source,
        supplier_code,
        supplier_name,
        arrive_Date: fechaLlegada,
        currency: moneda,
        price_best: precioNeto,
        stock: stockDisponible,
        stock_transit: stockTransito,
      };
      await sendToHistory(product_id, skuu[0].best_supplier);
      await updateBestSupplier(product_id, resultObject);
    }

    res.send(dataPriceStock);
  } catch (error) {
    res.send(error);
  }
});

const updateBestSupplier = async (product_id, resultObject) => {
  try {
    const productRef = db.collection("products").doc(product_id);
    const updateData = {
      best_supplier: resultObject,
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    }
    await productRef.update(updateData);

  } catch (error) {
    console.log(error)
  }
};

const sendToHistory = async (product_id, best_supplier) => {
  try {
    const productRef = db.collection("products").doc(product_id)
    const historyRef = productRef.collection("history")
    
    await historyRef.add({
      hola:'hola',
      data: best_supplier,
    });

    console.log("Información añadida a la colección 'history' correctamente");
  } catch (error) {
    console.error("Error al enviar a historial:", error);
    throw error;
  }
};

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
