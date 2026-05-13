import swaggerJSDOC from "swagger-jsdoc";
import swaggerUI from "swagger-ui-express";

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Product API",
      version: "1.0.0",
      description: "API documentation for product management",
    },
  },
  servers: [
    {
      url: "http://localhost:3000",
      description: "local server",
    },
  ],
  components: {
    securitySchemes: {
      bearAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
    },
  },
  security: [
    {
      bearAuth: [],
    },
  ],
  // nơi swaggerjsdoc sẽ quét các chú thích để tạo tài liệu api
  apis: ["./src/routes/*.js", "./src/models/*.js"], //Đường dẫn tới các file route và model để swaggerjsdoc quét các chú thích
};

const swaggerSpec = swaggerJSDOC(options);

export const setupSwagger = (app) => {
  app.use("/api-docs", swaggerUI.serve, swaggerUI.setup(swaggerSpec));
};
