sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox"
], function (Controller, JSONModel, MessageToast, MessageBox) {
    "use strict";

    const BASE_URL = "/api/admin";

    return Controller.extend("cv.viewer.cvviewer.controller.Wizard", {

        // ─── Lifecycle ───────────────────────────────────────────────
        onInit: function () {
            this._currentStep = 1;
            this._profileId = null;

            const oModel = new JSONModel({
                profile: {
                    firstName: "", lastName: "", title: "",
                    summary: "", email: "", phone: "",
                    location: "", linkedinUrl: "", githubUrl: "", photoUrl: ""
                },
                skills: [],
                experiences: [],
                projects: [],
                education: [],
                certifications: [],
                languages: [],
                busy: false
            });

            this.getView().setModel(oModel, "wizard");
            this._loadExistingData();
        },

        // ─── Cargar datos existentes ─────────────────────────────────
        _loadExistingData: function () {
            fetch(`${BASE_URL}/Profile?$top=1`)
                .then(res => res.ok ? res.json() : null)
                .then(data => {
                    if (!data || !data.value || data.value.length === 0) return;

                    const oRaw = data.value[0];
                    this._profileId = oRaw.ID;
                    const oModel = this.getView().getModel("wizard");

                    // Solo campos permitidos del Profile
                    const aAllowed = ["firstName", "lastName", "title", "summary", "email", "phone", "location", "linkedinUrl", "githubUrl", "photoUrl"];
                    const oProfile = {};
                    aAllowed.forEach(sField => { oProfile[sField] = oRaw[sField] || ""; });
                    oModel.setProperty("/profile", oProfile);

                    const aEntities = ["Skills", "Experiences", "Projects", "Education", "Certifications", "Languages"];
                    const aKeys = ["skills", "experiences", "projects", "education", "certifications", "languages"];

                    aEntities.forEach((sEntity, i) => {
                        fetch(`${BASE_URL}/${sEntity}?$filter=profile_ID eq ${this._profileId}`)
                            .then(res => res.ok ? res.json() : { value: [] })
                            .then(result => {
                                const aItems = (result.value || []).map(item => {
                                    const oClean = this._cleanItem(item);
                                    oClean.ID = item.ID;
                                    oClean.__state = "saved";
                                    return oClean;
                                });
                                oModel.setProperty(`/${aKeys[i]}`, aItems);
                            });
                    });
                })
                .catch(err => console.error("Error cargando datos existentes:", err));
        },

        // ─── Navegación ──────────────────────────────────────────────
        onNext: function () {
            if (!this._validateStep(this._currentStep)) return;

            const oWizard = this.byId("wizard");
            const aSteps = oWizard.getSteps();
            const oCurrentStep = aSteps[this._currentStep - 1];

            oWizard.validateStep(oCurrentStep);
            this._currentStep++;
            oWizard.nextStep();
            this._updateButtons();
        },

        onBack: function () {
            if (this._currentStep > 1) {
                this._currentStep--;
                this.byId("wizard").previousStep();
                this._updateButtons();
            }
        },

        onStepActivate: function (oEvent) {
            const iStep = oEvent.getParameter("index");
            this._currentStep = iStep;
            this._updateButtons();
        },

        _updateButtons: function () {
            const iStep = this._currentStep;
            this.byId("btnBack").setVisible(iStep > 1);
            this.byId("btnNext").setVisible(iStep < 7);
            this.byId("btnFinish").setVisible(iStep === 7);
        },

        // ─── Validaciones ────────────────────────────────────────────
        _validateStep: function (iStep) {
            if (iStep === 1) {
                const oProfile = this.getView().getModel("wizard").getProperty("/profile");
                if (!oProfile.firstName || !oProfile.lastName || !oProfile.email) {
                    MessageBox.warning("Nombre, apellido y email son obligatorios.");
                    return false;
                }
            }
            return true;
        },

        // ─── Guardar TODO al finalizar ───────────────────────────────
        onWizardComplete: function () {
            const oModel = this.getView().getModel("wizard");
            oModel.setProperty("/busy", true);

            this._saveProfile()
                .then(() => Promise.all([
                    this._saveCollection("skills"),
                    this._saveCollection("experiences"),
                    this._saveCollection("projects"),
                    this._saveCollection("education"),
                    this._saveCollection("certifications"),
                    this._saveCollection("languages")
                ]))
                .then(() => {
                    oModel.setProperty("/busy", false);
                    MessageBox.success("🎉 CV guardado correctamente!", {
                        onClose: () => {
                            this.getOwnerComponent().getRouter().navTo("RouteView1");
                        }
                    });
                })
                .catch(err => {
                    oModel.setProperty("/busy", false);
                    MessageBox.error("Error al guardar: " + err.message);
                });
        },

        // ─── PASO 1: Guardar Profile ─────────────────────────────────
        _saveProfile: function () {
            const oRaw = this.getView().getModel("wizard").getProperty("/profile");

            // Whitelist estricto — solo campos de Profile
            const aAllowed = ["firstName", "lastName", "title", "summary", "email", "phone", "location", "linkedinUrl", "githubUrl", "photoUrl"];
            const oProfile = {};
            aAllowed.forEach(sField => {
                oProfile[sField] = oRaw[sField] || null;
            });

            const sMethod = this._profileId ? "PATCH" : "POST";
            const sUrl = this._profileId
                ? `${BASE_URL}/Profile/${this._profileId}`
                : `${BASE_URL}/Profile`;

            return fetch(sUrl, {
                method: sMethod,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(oProfile)
            })
                .then(res => {
                    if (!res.ok) return res.text().then(t => { throw new Error(t); });
                    return res.json();
                })
                .then(data => {
                    this._profileId = data.ID;
                });
        },

        // ─── PASOS 2-7: Guardar colecciones ─────────────────────────
        _saveCollection: function (sEntity) {
            if (!this._profileId) return Promise.resolve();

            const oModel = this.getView().getModel("wizard");
            const aItems = oModel.getProperty(`/${sEntity}`);
            const sEntityName = this._getEntityName(sEntity);
            const aPromises = [];

            aItems.forEach((item, iIndex) => {
                if (item.__state === "deleted") return;

                if (!item.ID || item.__state === "new") {
                    const oBody = this._cleanItem({ ...item, profile_ID: this._profileId });
                    aPromises.push(
                        fetch(`${BASE_URL}/${sEntityName}`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(oBody)
                        })
                            .then(res => {
                                if (!res.ok) return res.text().then(t => { throw new Error(t); });
                                return res.json();
                            })
                            .then(data => {
                                oModel.setProperty(`/${sEntity}/${iIndex}/ID`, data.ID);
                                oModel.setProperty(`/${sEntity}/${iIndex}/__state`, "saved");
                            })
                    );
                } else if (item.__state === "modified") {
                    const oBody = this._cleanItem({ ...item, profile_ID: this._profileId });
                    aPromises.push(
                        fetch(`${BASE_URL}/${sEntityName}/${item.ID}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(oBody)
                        })
                            .then(res => {
                                if (!res.ok) return res.text().then(t => { throw new Error(t); });
                                oModel.setProperty(`/${sEntity}/${iIndex}/__state`, "saved");
                            })
                    );
                }
            });

            // DELETE los marcados
            aItems.filter(i => i.__state === "deleted" && i.ID).forEach(item => {
                aPromises.push(
                    fetch(`${BASE_URL}/${sEntityName}/${item.ID}`, { method: "DELETE" })
                        .then(res => { if (!res.ok) return res.text().then(t => { throw new Error(t); }); })
                );
            });

            const aRemaining = aItems.filter(i => i.__state !== "deleted");
            oModel.setProperty(`/${sEntity}`, aRemaining);

            return Promise.all(aPromises);
        },

        // ─── ABM: Agregar fila ───────────────────────────────────────
        onAddItem: function (oEvent) {
            const sEntity = oEvent.getSource().data("entity");
            const oModel = this.getView().getModel("wizard");
            const aItems = oModel.getProperty(`/${sEntity}`) || [];
            const oNew = { ...this._getEmptyItem(sEntity), __state: "new" };
            aItems.push(oNew);
            oModel.setProperty(`/${sEntity}`, aItems);
        },

        // ─── ABM: Eliminar fila ──────────────────────────────────────
        onDeleteItem: function (oEvent) {
            const oCtx = oEvent.getSource().getBindingContext("wizard");
            const sPath = oCtx.getPath();
            const aParts = sPath.split("/");
            const sEntity = aParts[1];
            const iIndex = parseInt(aParts[2]);

            const oModel = this.getView().getModel("wizard");
            const aItems = oModel.getProperty(`/${sEntity}`);
            const oItem = aItems[iIndex];

            MessageBox.confirm("¿Eliminás este item?", {
                onClose: (sAction) => {
                    if (sAction !== MessageBox.Action.OK) return;
                    if (oItem.ID) {
                        aItems[iIndex].__state = "deleted";
                        oModel.setProperty(`/${sEntity}`, aItems.filter(i => i.__state !== "deleted"));
                    } else {
                        aItems.splice(iIndex, 1);
                        oModel.setProperty(`/${sEntity}`, [...aItems]);
                    }
                }
            });
        },

        // ─── ABM: Marcar como modificado ────────────────────────────
        onItemChange: function (oEvent) {
            const oCtx = oEvent.getSource().getBindingContext("wizard");
            if (!oCtx) return;
            const sPath = oCtx.getPath();
            const aParts = sPath.split("/");
            const sEntity = aParts[1];
            const iIndex = parseInt(aParts[2]);
            const oModel = this.getView().getModel("wizard");
            const oItem = oModel.getProperty(`/${sEntity}/${iIndex}`);
            if (oItem && oItem.__state === "saved") {
                oModel.setProperty(`/${sEntity}/${iIndex}/__state`, "modified");
            }
        },

        onProfileChange: function () { },

        // ─── Helpers ─────────────────────────────────────────────────
        _getEntityName: function (sKey) {
            const map = {
                skills: "Skills",
                experiences: "Experiences",
                projects: "Projects",
                education: "Education",
                certifications: "Certifications",
                languages: "Languages"
            };
            return map[sKey];
        },

        _cleanItem: function (oItem) {
            const oClean = {};

            // Excluir metadata OData, campos internos y campos de navegación
            Object.keys(oItem).forEach(sKey => {
                if (!sKey.startsWith("@") && sKey !== "__state" && sKey !== "__index") {
                    oClean[sKey] = oItem[sKey];
                }
            });

            // Convertir strings vacíos de fechas a null
            ["startDate", "endDate"].forEach(sField => {
                if (sField in oClean && (oClean[sField] === "" || oClean[sField] === undefined)) {
                    oClean[sField] = null;
                }
            });

            // Convertir strings vacíos de números a null
            ["startYear", "endYear", "issueYear"].forEach(sField => {
                if (sField in oClean && (oClean[sField] === "" || oClean[sField] === 0 || oClean[sField] === undefined)) {
                    oClean[sField] = null;
                }
            });

            return oClean;
        },

        _getEmptyItem: function (sEntity) {
            const map = {
                skills: { name: "", category: "", level: 1 },
                experiences: { company: "", role: "", location: "", startDate: "", endDate: "", current: false, description: "", technologies: "" },
                projects: { name: "", description: "", technologies: "", projectUrl: "", imageUrl: "" },
                education: { institution: "", degree: "", fieldOfStudy: "", startYear: null, endYear: null },
                certifications: { name: "", issuingOrg: "", issueYear: null, credentialUrl: "" },
                languages: { language: "", proficiency: "" }
            };
            return { ...map[sEntity] };
        }

    });
});