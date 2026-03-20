sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox"
], function (Controller, JSONModel, MessageToast, MessageBox) {
    "use strict";

    const BASE_URL = "/api/admin";

    return Controller.extend("cv.viewer.cvviewer.controller.Wizard", {

        onInit: function () {
            this._currentStep = 1;
            this._profileId = null;

            const sPath = window.location.pathname || "";
            const sHash = window.location.hash || "";

            const bIsWizard = sHash.indexOf("wizard") !== -1;
            const bIsAdminEntry = sPath === "/admin";

            if (bIsWizard && !bIsAdminEntry) {
                window.location.replace("/admin#/wizard");
                return;
            }

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
                recruiterLeads: [],
                busy: false
            });

            this.getView().setModel(oModel, "wizard");
            this._loadExistingData();
        },

        _fetchCsrfToken: function () {
            return fetch(`${BASE_URL}/Profile`, {
                method: "GET",
                headers: {
                    "x-csrf-token": "Fetch"
                },
                credentials: "same-origin"
            }).then(res => {
                if (res.status === 401 || res.status === 403) {
                    const oError = new Error("No autorizado");
                    oError.status = res.status;
                    throw oError;
                }

                const sToken = res.headers.get("x-csrf-token");
                if (!sToken) {
                    throw new Error("No se pudo obtener el CSRF token.");
                }

                return sToken;
            });
        },

        _loadExistingData: async function () {
            try {
                const res = await fetch(`${BASE_URL}/Profile?$top=1`, {
                    method: "GET",
                    credentials: "same-origin"
                });

                if (res.status === 401 || res.status === 403) {
                    window.location.replace("/admin#/wizard");
                    return;
                }

                if (!res.ok) {
                    const sErrorText = await res.text();
                    throw new Error(sErrorText);
                }

                const sContentType = res.headers.get("content-type") || "";
                if (!sContentType.includes("application/json")) {
                    const sRaw = await res.text();
                    throw new Error("La API devolvió HTML en vez de JSON: " + sRaw.substring(0, 120));
                }

                const data = await res.json();

                if (data && data.value && data.value.length > 0) {
                    const oRaw = data.value[0];
                    this._profileId = oRaw.ID;

                    const oModel = this.getView().getModel("wizard");

                    const aAllowed = [
                        "firstName", "lastName", "title", "summary", "email",
                        "phone", "location", "linkedinUrl", "githubUrl", "photoUrl"
                    ];

                    const oProfile = {};
                    aAllowed.forEach(function (sField) {
                        oProfile[sField] = oRaw[sField] || "";
                    });

                    oModel.setProperty("/profile", oProfile);

                    const aEntities = ["Skills", "Experiences", "Projects", "Education", "Certifications", "Languages"];
                    const aKeys = ["skills", "experiences", "projects", "education", "certifications", "languages"];

                    for (let i = 0; i < aEntities.length; i++) {
                        const sEntity = aEntities[i];
                        const sKey = aKeys[i];

                        const resEntity = await fetch(`${BASE_URL}/${sEntity}?$filter=profile_ID eq ${this._profileId}`, {
                            method: "GET",
                            credentials: "same-origin"
                        });

                        if (resEntity.status === 401 || resEntity.status === 403) {
                            window.location.replace("/admin#/wizard");
                            return;
                        }

                        if (!resEntity.ok) {
                            const sErrorText = await resEntity.text();
                            throw new Error(sErrorText);
                        }

                        const sEntityContentType = resEntity.headers.get("content-type") || "";
                        if (!sEntityContentType.includes("application/json")) {
                            const sRaw = await resEntity.text();
                            throw new Error("La API devolvió HTML en vez de JSON para " + sEntity + ": " + sRaw.substring(0, 120));
                        }

                        const result = await resEntity.json();

                        const aItems = (result.value || []).map(item => {
                            const oClean = this._cleanItem(item);
                            oClean.ID = item.ID;
                            oClean.__state = "saved";
                            return oClean;
                        });

                        oModel.setProperty(`/${sKey}`, aItems);
                    }
                }

                await this._loadRecruiterLeads();

            } catch (err) {
                console.error("Error cargando datos existentes:", err);
                MessageBox.error("Error cargando datos existentes: " + err.message);
            }
        },

        _loadRecruiterLeads: async function () {
            const oModel = this.getView().getModel("wizard");

            const res = await fetch(`${BASE_URL}/RecruiterLeads?$orderby=createdAt desc`, {
                method: "GET",
                credentials: "same-origin"
            });

            if (res.status === 401 || res.status === 403) {
                window.location.replace("/admin#/wizard");
                return;
            }

            if (!res.ok) {
                const sErrorText = await res.text();
                throw new Error("Error cargando leads: " + sErrorText);
            }

            const sContentType = res.headers.get("content-type") || "";
            if (!sContentType.includes("application/json")) {
                const sRaw = await res.text();
                throw new Error("La API devolvió HTML en vez de JSON para RecruiterLeads: " + sRaw.substring(0, 120));
            }

            const result = await res.json();

            const aLeads = (result.value || []).map(function (oLead) {
                const sStatus = oLead.status || "NEW";

                return Object.assign({}, oLead, {
                    createdAtFormatted: this._formatDateTime(oLead.createdAt),
                    statusState: this._mapLeadStatusState(sStatus)
                });
            }.bind(this));

            oModel.setProperty("/recruiterLeads", aLeads);
        },

        _mapLeadStatusState: function (sStatus) {
            switch (sStatus) {
                case "CONTACTED":
                    return "Success";
                case "DISCARDED":
                    return "Error";
                case "NEW":
                default:
                    return "Warning";
            }
        },

        _formatDateTime: function (vDate) {
            if (!vDate) {
                return "";
            }

            const oDate = new Date(vDate);
            if (isNaN(oDate.getTime())) {
                return String(vDate);
            }

            const sDay = String(oDate.getDate()).padStart(2, "0");
            const sMonth = String(oDate.getMonth() + 1).padStart(2, "0");
            const sYear = oDate.getFullYear();
            const sHours = String(oDate.getHours()).padStart(2, "0");
            const sMinutes = String(oDate.getMinutes()).padStart(2, "0");

            return `${sDay}/${sMonth}/${sYear} ${sHours}:${sMinutes}`;
        },

        onMarkLeadAsContacted: function (oEvent) {
            const oCtx = oEvent.getSource().getBindingContext("wizard");
            const oLead = oCtx.getObject();

            MessageBox.confirm(`¿Marcar como contactado a "${oLead.fullName}"?`, {
                onClose: async (sAction) => {
                    if (sAction !== MessageBox.Action.OK) {
                        return;
                    }

                    try {
                        const sToken = await this._fetchCsrfToken();

                        const res = await fetch(`${BASE_URL}/markLeadAsContacted`, {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                                "x-csrf-token": sToken
                            },
                            credentials: "same-origin",
                            body: JSON.stringify({ ID: oLead.ID })
                        });

                        if (!res.ok) {
                            const sErrorText = await res.text();
                            throw new Error(sErrorText);
                        }

                        const data = await res.json();
                        MessageToast.show(data.message || "Lead marcado como contactado.");
                        await this._loadRecruiterLeads();
                    } catch (err) {
                        MessageBox.error("No se pudo actualizar el lead: " + err.message);
                    }
                }
            });
        },

        onDiscardLead: function (oEvent) {
            const oCtx = oEvent.getSource().getBindingContext("wizard");
            const oLead = oCtx.getObject();

            MessageBox.confirm(`¿Descartar a "${oLead.fullName}"?`, {
                onClose: async (sAction) => {
                    if (sAction !== MessageBox.Action.OK) {
                        return;
                    }

                    try {
                        const sToken = await this._fetchCsrfToken();

                        const res = await fetch(`${BASE_URL}/discardLead`, {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                                "x-csrf-token": sToken
                            },
                            credentials: "same-origin",
                            body: JSON.stringify({ ID: oLead.ID })
                        });

                        if (!res.ok) {
                            const sErrorText = await res.text();
                            throw new Error(sErrorText);
                        }

                        const data = await res.json();
                        MessageToast.show(data.message || "Lead descartado.");
                        await this._loadRecruiterLeads();
                    } catch (err) {
                        MessageBox.error("No se pudo actualizar el lead: " + err.message);
                    }
                }
            });
        },

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
            this.byId("btnNext").setVisible(iStep < 8);
            this.byId("btnFinish").setVisible(iStep === 8);
        },

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
                .then(() => this._loadRecruiterLeads())
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

                    if (err && (err.status === 401 || err.status === 403)) {
                        window.location.replace("/admin#/wizard");
                        return;
                    }

                    MessageBox.error("Error al guardar: " + err.message);
                });
        },

        _saveProfile: function () {
            const oRaw = this.getView().getModel("wizard").getProperty("/profile");

            const aAllowed = [
                "firstName", "lastName", "title", "summary", "email",
                "phone", "location", "linkedinUrl", "githubUrl", "photoUrl"
            ];

            const oProfile = {};
            aAllowed.forEach(sField => {
                oProfile[sField] = oRaw[sField] || null;
            });

            const sMethod = this._profileId ? "PATCH" : "POST";
            const sUrl = this._profileId
                ? `${BASE_URL}/Profile/${this._profileId}`
                : `${BASE_URL}/Profile`;

            return this._fetchCsrfToken()
                .then(sToken => {
                    return fetch(sUrl, {
                        method: sMethod,
                        headers: {
                            "Content-Type": "application/json",
                            "x-csrf-token": sToken
                        },
                        credentials: "same-origin",
                        body: JSON.stringify(oProfile)
                    });
                })
                .then(res => {
                    if (res.status === 401 || res.status === 403) {
                        const oError = new Error("No autorizado");
                        oError.status = res.status;
                        throw oError;
                    }
                    if (!res.ok) {
                        return res.text().then(t => { throw new Error(t); });
                    }
                    return res.json();
                })
                .then(data => {
                    if (data && data.ID) {
                        this._profileId = data.ID;
                    }
                });
        },

        _saveCollection: function (sEntity) {
            if (!this._profileId) return Promise.resolve();

            return this._fetchCsrfToken().then(sToken => {
                const oModel = this.getView().getModel("wizard");
                const aItems = oModel.getProperty(`/${sEntity}`) || [];
                const sEntityName = this._getEntityName(sEntity);
                const aPromises = [];

                aItems.forEach((item, iIndex) => {
                    if (item.__state === "deleted") return;

                    if (!item.ID || item.__state === "new") {
                        const oBody = this._cleanItem({ ...item, profile_ID: this._profileId });
                        aPromises.push(
                            fetch(`${BASE_URL}/${sEntityName}`, {
                                method: "POST",
                                headers: {
                                    "Content-Type": "application/json",
                                    "x-csrf-token": sToken
                                },
                                credentials: "same-origin",
                                body: JSON.stringify(oBody)
                            })
                                .then(res => {
                                    if (res.status === 401 || res.status === 403) {
                                        const oError = new Error("No autorizado");
                                        oError.status = res.status;
                                        throw oError;
                                    }
                                    if (!res.ok) {
                                        return res.text().then(t => { throw new Error(t); });
                                    }
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
                                headers: {
                                    "Content-Type": "application/json",
                                    "x-csrf-token": sToken
                                },
                                credentials: "same-origin",
                                body: JSON.stringify(oBody)
                            })
                                .then(res => {
                                    if (res.status === 401 || res.status === 403) {
                                        const oError = new Error("No autorizado");
                                        oError.status = res.status;
                                        throw oError;
                                    }
                                    if (!res.ok) {
                                        return res.text().then(t => { throw new Error(t); });
                                    }
                                    oModel.setProperty(`/${sEntity}/${iIndex}/__state`, "saved");
                                })
                        );
                    }
                });

                aItems.filter(i => i.__state === "deleted" && i.ID).forEach(item => {
                    aPromises.push(
                        fetch(`${BASE_URL}/${sEntityName}/${item.ID}`, {
                            method: "DELETE",
                            headers: {
                                "x-csrf-token": sToken
                            },
                            credentials: "same-origin"
                        })
                            .then(res => {
                                if (res.status === 401 || res.status === 403) {
                                    const oError = new Error("No autorizado");
                                    oError.status = res.status;
                                    throw oError;
                                }
                                if (!res.ok) {
                                    return res.text().then(t => { throw new Error(t); });
                                }
                            })
                    );
                });

                const aRemaining = aItems.filter(i => i.__state !== "deleted");
                oModel.setProperty(`/${sEntity}`, aRemaining);

                return Promise.all(aPromises);
            });
        },

        onAddItem: function (oEvent) {
            const sEntity = oEvent.getSource().data("entity");
            const oModel = this.getView().getModel("wizard");
            const aItems = oModel.getProperty(`/${sEntity}`) || [];
            const oNew = { ...this._getEmptyItem(sEntity), __state: "new" };
            aItems.push(oNew);
            oModel.setProperty(`/${sEntity}`, aItems);
        },

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

            Object.keys(oItem).forEach(sKey => {
                if (!sKey.startsWith("@") && sKey !== "__state" && sKey !== "__index") {
                    oClean[sKey] = oItem[sKey];
                }
            });

            ["startDate", "endDate"].forEach(sField => {
                if (sField in oClean && (oClean[sField] === "" || oClean[sField] === undefined)) {
                    oClean[sField] = null;
                }
            });

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