import Service from "../models/service.models.js";

export const getServices = async (req, res) => {
  try {
    const services = await Service.find({ isActive: true }).sort({ createdAt: -1 });
    return res.status(200).json({ services });
  } catch (error) {
    return res.status(500).json({ message: "internal server error", error: error.message });
  }
};

export const createService = async (req, res) => {
  try {
    const { name, code, description, pricePerHour, defaultChecklist } = req.body;
    if (!name || !code || pricePerHour === undefined) {
      return res.status(400).json({ message: "name, code and pricePerHour are required" });
    }

    const service = await Service.create({
      name,
      code,
      description,
      pricePerHour,
      defaultChecklist,
    });

    return res.status(201).json({ message: "service created", service });
  } catch (error) {
    return res.status(500).json({ message: "internal server error", error: error.message });
  }
};

export const updateService = async (req, res) => {
  try {
    const service = await Service.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!service) {
      return res.status(404).json({ message: "service not found" });
    }

    return res.status(200).json({ message: "service updated", service });
  } catch (error) {
    return res.status(500).json({ message: "internal server error", error: error.message });
  }
};

export const deleteService = async (req, res) => {
  try {
    const service = await Service.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true },
    );
    if (!service) {
      return res.status(404).json({ message: "service not found" });
    }

    return res.status(200).json({ message: "service disabled", service });
  } catch (error) {
    return res.status(500).json({ message: "internal server error", error: error.message });
  }
};
