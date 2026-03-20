sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/odata/v4/ODataModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/m/Dialog",
    "sap/m/Button",
    "sap/m/VBox",
    "sap/m/HBox",
    "sap/m/Text",
    "sap/m/Title",
    "sap/m/Label",
    "sap/m/Input",
    "sap/m/TextArea",
    "sap/m/CheckBox",
    "sap/ui/core/Icon"
], function (
    Controller,
    JSONModel,
    ODataModel,
    Filter,
    FilterOperator,
    MessageToast,
    MessageBox,
    Dialog,
    Button,
    VBox,
    HBox,
    Text,
    Title,
    Label,
    Input,
    TextArea,
    CheckBox,
    Icon
) {
    "use strict";

    return Controller.extend("cv.viewer.cvviewer.controller.View1", {

        onInit: function () {
            var oView = this.getView();
            var that = this;

            var oLocalModel = new JSONModel({
                profile: {},
                skills: [],
                experiences: [],
                projects: [],
                education: [],
                certifications: [],
                languages: []
            });
            oView.setModel(oLocalModel, "cv");

            var oLeadModel = new JSONModel({
                fullName: "",
                email: "",
                company: "",
                phone: "",
                role: "",
                message: "",
                consentAccepted: false
            });
            oView.setModel(oLeadModel, "lead");

            var oODataModel = new ODataModel({
                serviceUrl: "/api/public/",
                synchronizationMode: "None",
                operationMode: "Server",
                autoExpandSelect: true
            });

            oODataModel.bindList("/Profile").requestContexts(0, 1)
                .then(function (aProfileContexts) {
                    if (!aProfileContexts.length) {
                        return;
                    }

                    var oProfile = aProfileContexts[0].getObject();
                    var sProfileId = oProfile.ID;
                    var oModel = that.getView().getModel("cv");

                    oModel.setProperty("/profile", oProfile);

                    return Promise.all([
                        oODataModel.bindList("/Skills", undefined, undefined, [
                            new Filter("profile_ID", FilterOperator.EQ, sProfileId)
                        ]).requestContexts(0, 100),

                        oODataModel.bindList("/Experiences", undefined, undefined, [
                            new Filter("profile_ID", FilterOperator.EQ, sProfileId)
                        ]).requestContexts(0, 100),

                        oODataModel.bindList("/Projects", undefined, undefined, [
                            new Filter("profile_ID", FilterOperator.EQ, sProfileId)
                        ]).requestContexts(0, 100),

                        oODataModel.bindList("/Education", undefined, undefined, [
                            new Filter("profile_ID", FilterOperator.EQ, sProfileId)
                        ]).requestContexts(0, 100),

                        oODataModel.bindList("/Certifications", undefined, undefined, [
                            new Filter("profile_ID", FilterOperator.EQ, sProfileId)
                        ]).requestContexts(0, 100),

                        oODataModel.bindList("/Languages", undefined, undefined, [
                            new Filter("profile_ID", FilterOperator.EQ, sProfileId)
                        ]).requestContexts(0, 100)
                    ]).then(function (aResults) {
                        var aSkills = aResults[0].map(function (c) { return c.getObject(); });
                        var aExperiences = aResults[1].map(function (c) { return c.getObject(); });
                        var aProjects = aResults[2].map(function (c) { return c.getObject(); });
                        var aEducation = aResults[3].map(function (c) { return c.getObject(); });
                        var aCerts = aResults[4].map(function (c) { return c.getObject(); });
                        var aLanguages = aResults[5].map(function (c) { return c.getObject(); });

                        aSkills = that._sortSkills(aSkills);
                        aExperiences = that._sortExperiences(aExperiences);

                        aCerts.sort(function (a, b) {
                            return (b.issueYear || 0) - (a.issueYear || 0);
                        });

                        oModel.setProperty("/skills", aSkills);
                        oModel.setProperty("/experiences", aExperiences);
                        oModel.setProperty("/projects", aProjects);
                        oModel.setProperty("/education", aEducation);
                        oModel.setProperty("/certifications", aCerts);
                        oModel.setProperty("/languages", aLanguages);

                        that._snapInitialized = false;
                        setTimeout(function () {
                            that._initSnapScroll();
                        }, 600);
                    });
                })
                .catch(function (oError) {
                    console.error("Error:", oError);
                });

            this.getView().addEventDelegate({
                onAfterRendering: function () {
                    setTimeout(function () {
                        that._initSnapScroll();
                    }, 300);
                }
            });
        },

        _getSkillCategoryOrder: function () {
            return [
                "Backend",
                "Frontend",
                "SAP",
                "Database",
                "Base de Datos",
                "Bases de Datos",
                "Cloud",
                "DevOps",
                "Soft Skill",
                "Other",
                "Otros",
                "Herramientas",
                "Tools"
            ];
        },

        _sortSkills: function (aSkills) {
            var aCategoryOrder = this._getSkillCategoryOrder();

            return aSkills.slice().sort(function (a, b) {
                var sCatA = (a.category || "Other").trim();
                var sCatB = (b.category || "Other").trim();

                var iCatA = aCategoryOrder.indexOf(sCatA);
                var iCatB = aCategoryOrder.indexOf(sCatB);

                iCatA = iCatA === -1 ? 999 : iCatA;
                iCatB = iCatB === -1 ? 999 : iCatB;

                if (iCatA !== iCatB) {
                    return iCatA - iCatB;
                }

                return (a.name || "").localeCompare((b.name || ""), "es", { sensitivity: "base" });
            });
        },

        _sortExperiences: function (aExperiences) {
            return aExperiences.slice().sort(function (a, b) {
                var iA = this._toTime(a.startDate);
                var iB = this._toTime(b.startDate);

                if (iA !== iB) {
                    return iB - iA;
                }

                var iEndA = this._toTime(a.endDate);
                var iEndB = this._toTime(b.endDate);

                return iEndB - iEndA;
            }.bind(this));
        },

        _toTime: function (vDate) {
            if (!vDate) {
                return 0;
            }

            var iTime = new Date(vDate).getTime();
            return isNaN(iTime) ? 0 : iTime;
        },

        _initSnapScroll: function () {
            if (this._snapInitialized) {
                return;
            }

            var oPageDom = this.byId("page").getDomRef();
            if (!oPageDom) {
                return;
            }

            var oScroller = oPageDom.querySelector(".sapMPageScroll");
            if (!oScroller) {
                return;
            }

            var aSections = Array.from(
                oScroller.querySelectorAll(".cvSnapSection")
            ).filter(function (el) {
                return el.offsetHeight > 0;
            });

            if (!aSections.length) {
                return;
            }

            this._snapInitialized = true;
            var bScrolling = false;

            var fnGetCurrent = function () {
                var iScrollTop = oScroller.scrollTop;
                var iBest = 0;
                var iMin = Infinity;

                aSections.forEach(function (oSec, i) {
                    var iDist = Math.abs(oSec.offsetTop - iScrollTop);
                    if (iDist < iMin) {
                        iMin = iDist;
                        iBest = i;
                    }
                });

                return iBest;
            };

            var fnScrollTo = function (iIndex) {
                if (iIndex < 0 || iIndex >= aSections.length) {
                    return;
                }

                bScrolling = true;
                aSections[iIndex].scrollIntoView({ behavior: "smooth", block: "start" });

                setTimeout(function () {
                    bScrolling = false;
                }, 900);
            };

            oScroller.addEventListener("wheel", function (oEvent) {
                oEvent.preventDefault();
                if (bScrolling) {
                    return;
                }
                fnScrollTo(oEvent.deltaY > 0 ? fnGetCurrent() + 1 : fnGetCurrent() - 1);
            }, { passive: false });

            var iTouchStartY = 0;

            oScroller.addEventListener("touchstart", function (oEvent) {
                iTouchStartY = oEvent.touches[0].clientY;
            }, { passive: true });

            oScroller.addEventListener("touchend", function (oEvent) {
                if (bScrolling) {
                    return;
                }

                var iDelta = iTouchStartY - oEvent.changedTouches[0].clientY;
                if (Math.abs(iDelta) < 40) {
                    return;
                }

                fnScrollTo(iDelta > 0 ? fnGetCurrent() + 1 : fnGetCurrent() - 1);
            }, { passive: true });

            document.addEventListener("keydown", function (oEvent) {
                if (bScrolling) {
                    return;
                }

                if (oEvent.key === "ArrowDown" || oEvent.key === "PageDown") {
                    oEvent.preventDefault();
                    fnScrollTo(fnGetCurrent() + 1);
                } else if (oEvent.key === "ArrowUp" || oEvent.key === "PageUp") {
                    oEvent.preventDefault();
                    fnScrollTo(fnGetCurrent() - 1);
                }
            });
        },

        _formatMonthYear: function (vDate) {
            if (!vDate) {
                return "";
            }

            var oDate = new Date(vDate);
            if (isNaN(oDate.getTime())) {
                return String(vDate);
            }

            var aMonths = [
                "01", "02", "03", "04", "05", "06",
                "07", "08", "09", "10", "11", "12"
            ];

            return aMonths[oDate.getMonth()] + "/" + oDate.getFullYear();
        },

        _formatDateRange: function (sStartDate, sEndDate) {
            var sStart = this._formatMonthYear(sStartDate);
            var sEnd = this._formatMonthYear(sEndDate);

            if (sStart && sEnd) {
                return sStart + " - " + sEnd;
            }

            if (sStart && !sEnd) {
                return sStart + " - Actualidad";
            }

            return sStart || sEnd || "";
        },

        _sanitizeText: function (sText) {
            if (!sText) {
                return "";
            }

            return String(sText)
                .replace(/\s+/g, " ")
                .replace(/\s,\s/g, ", ")
                .replace(/\s\.\s/g, ". ")
                .trim();
        },

        _extractBulletLines: function (sText) {
            if (!sText) {
                return [];
            }

            var sNormalized = String(sText)
                .replace(/\r/g, "\n")
                .replace(/•/g, "\n• ")
                .replace(/\n{2,}/g, "\n");

            var aLines = sNormalized
                .split("\n")
                .map(function (sLine) {
                    return sLine
                        .replace(/^[\-\*\•]\s*/, "")
                        .trim();
                })
                .filter(Boolean);

            if (aLines.length > 1) {
                return aLines;
            }

            return [];
        },

        _splitLongTextAsBullets: function (sText) {
            if (!sText) {
                return [];
            }

            return String(sText)
                .split(/[.;]\s+/)
                .map(function (sPart) {
                    return sPart.trim();
                })
                .filter(function (sPart) {
                    return sPart.length > 3;
                });
        },

        _addWrappedText: function (pdf, sText, x, y, maxWidth, lineHeight) {
            var aLines = pdf.splitTextToSize(sText, maxWidth);
            pdf.text(aLines, x, y);
            return y + (aLines.length * lineHeight);
        },

        _ensurePageSpace: function (pdf, y, needed) {
            if (y + needed > 277) {
                pdf.addPage();
                return 20;
            }
            return y;
        },

        _resetLeadModel: function () {
            this.getView().getModel("lead").setData({
                fullName: "",
                email: "",
                company: "",
                phone: "",
                role: "",
                message: "",
                consentAccepted: false
            });
        },

        onOpenRecruiterLeadDialog: function () {
            if (!this._oRecruiterLeadDialog) {
                this._oRecruiterLeadDialog = this._createRecruiterLeadDialog();
                this.getView().addDependent(this._oRecruiterLeadDialog);
            }

            this._resetLeadModel();
            this._oRecruiterLeadDialog.open();
        },

        _createRecruiterLeadDialog: function () {
            var oDialog = new Dialog({
                title: "Datos de contacto",
                contentWidth: "520px",
                horizontalScrolling: false,
                verticalScrolling: true,
                content: [
                    new VBox({
                        items: [
                            new Text({
                                text: "Si representás una empresa o sos recruiter, podés dejar tus datos para que te contacte."
                            }).addStyleClass("sapUiSmallMarginBottom"),

                            new Label({ text: "Nombre y apellido *" }),
                            new Input({
                                value: "{lead>/fullName}",
                                placeholder: "Ej: Ana Pérez"
                            }),

                            new Label({
                                text: "Email *"
                            }).addStyleClass("sapUiSmallMarginTop"),
                            new Input({
                                value: "{lead>/email}",
                                type: "Email",
                                placeholder: "Ej: ana@empresa.com"
                            }),

                            new Label({
                                text: "Empresa *"
                            }).addStyleClass("sapUiSmallMarginTop"),
                            new Input({
                                value: "{lead>/company}",
                                placeholder: "Ej: Mercado Libre"
                            }),

                            new Label({
                                text: "Teléfono"
                            }).addStyleClass("sapUiSmallMarginTop"),
                            new Input({
                                value: "{lead>/phone}",
                                placeholder: "Ej: +54 9 11 ..."
                            }),

                            new Label({
                                text: "Rol / cargo"
                            }).addStyleClass("sapUiSmallMarginTop"),
                            new Input({
                                value: "{lead>/role}",
                                placeholder: "Ej: Recruiter IT"
                            }),

                            new Label({
                                text: "Mensaje"
                            }).addStyleClass("sapUiSmallMarginTop"),
                            new TextArea({
                                value: "{lead>/message}",
                                rows: 4,
                                growing: true,
                                growingMaxLines: 6,
                                placeholder: "Opcional"
                            }),

                            new CheckBox({
                                selected: "{lead>/consentAccepted}",
                                text: "Acepto ser contactado con fines profesionales."
                            }).addStyleClass("sapUiSmallMarginTop")
                        ]
                    }).addStyleClass("sapUiContentPadding")
                ],
                beginButton: new Button({
                    text: "Enviar",
                    type: "Emphasized",
                    press: this.onSubmitRecruiterLead.bind(this)
                }),
                endButton: new Button({
                    text: "Cancelar",
                    press: function () {
                        oDialog.close();
                    }
                })
            });

            return oDialog;
        },

        _validateLeadData: function (oLeadData) {
            var sEmail = (oLeadData.email || "").trim();

            if (!(oLeadData.fullName || "").trim()) {
                MessageBox.warning("Completá el nombre y apellido.");
                return false;
            }

            if (!sEmail) {
                MessageBox.warning("Completá el email.");
                return false;
            }

            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sEmail)) {
                MessageBox.warning("Ingresá un email válido.");
                return false;
            }

            if (!(oLeadData.company || "").trim()) {
                MessageBox.warning("Completá la empresa.");
                return false;
            }

            if (!oLeadData.consentAccepted) {
                MessageBox.warning("Tenés que aceptar el consentimiento para ser contactado.");
                return false;
            }

            return true;
        },

        onSubmitRecruiterLead: async function () {
            var oLeadData = Object.assign({}, this.getView().getModel("lead").getData());

            if (!this._validateLeadData(oLeadData)) {
                return;
            }

            try {
                var oOperationModel = new ODataModel({
                    serviceUrl: "/api/public/",
                    synchronizationMode: "None",
                    operationMode: "Server",
                    autoExpandSelect: true
                });

                var oAction = oOperationModel.bindContext("/submitRecruiterLead(...)");

                oAction.setParameter("fullName", oLeadData.fullName || "");
                oAction.setParameter("email", oLeadData.email || "");
                oAction.setParameter("company", oLeadData.company || "");
                oAction.setParameter("phone", oLeadData.phone || "");
                oAction.setParameter("role", oLeadData.role || "");
                oAction.setParameter("message", oLeadData.message || "");
                oAction.setParameter("consentAccepted", !!oLeadData.consentAccepted);
                oAction.setParameter("source", "CV_APP_UI");

                await oAction.execute();

                var oResult = oAction.getBoundContext()
                    ? oAction.getBoundContext().getObject()
                    : null;

                MessageToast.show(
                    (oResult && oResult.message) || "Tus datos fueron registrados correctamente."
                );

                if (this._oRecruiterLeadDialog) {
                    this._oRecruiterLeadDialog.close();
                }

                this._resetLeadModel();

            } catch (oError) {
                console.error("Error al enviar lead:", oError);
                MessageBox.error(
                    (oError && oError.message) || "No se pudo registrar la información."
                );
            }
        },

        onDownloadProfessionalPDF: function () {
            try {
                if (!window.jspdf || !window.jspdf.jsPDF) {
                    MessageToast.show("Falta la librería para generar el PDF");
                    return;
                }

                var jsPDF = window.jspdf.jsPDF;
                var pdf = new jsPDF("p", "mm", "a4");
                var data = this.getView().getModel("cv").getData();

                var profile = data.profile || {};
                var skills = data.skills || [];
                var experiences = data.experiences || [];
                var projects = data.projects || [];
                var education = data.education || [];
                var certifications = data.certifications || [];
                var languages = data.languages || [];

                var y = 18;
                var pageWidth = 210;
                var left = 18;
                var right = 192;
                var center = pageWidth / 2;

                var drawRule = function (yPos) {
                    pdf.setDrawColor(90, 90, 90);
                    pdf.setLineWidth(0.3);
                    pdf.line(left, yPos, right, yPos);
                };

                var drawSectionTitle = function (sTitle) {
                    y += 4;
                    y = this._ensurePageSpace(pdf, y, 12);

                    drawRule(y);
                    pdf.setFont("times", "bold");
                    pdf.setFontSize(11);
                    pdf.text(String(sTitle).toUpperCase(), center, y + 4, { align: "center" });
                    drawRule(y + 6);

                    y += 13;
                }.bind(this);

                var addBulletList = function (aItems, startX, maxWidth) {
                    aItems.forEach(function (sItem) {
                        y = this._ensurePageSpace(pdf, y, 8);
                        pdf.setFont("times", "normal");
                        pdf.setFontSize(10);

                        pdf.text("•", startX, y);
                        var aLines = pdf.splitTextToSize(this._sanitizeText(sItem), maxWidth);
                        pdf.text(aLines, startX + 4, y);
                        y += aLines.length * 4.8;
                    }.bind(this));
                }.bind(this);

                pdf.setFont("times", "bold");
                pdf.setFontSize(18);
                pdf.text(
                    ((profile.firstName || "") + " " + (profile.lastName || "")).trim() || "CV",
                    center,
                    y,
                    { align: "center" }
                );

                y += 6;
                drawRule(y);

                var aContact = [
                    this._sanitizeText(profile.location),
                    this._sanitizeText(profile.phone),
                    this._sanitizeText(profile.email)
                ].filter(Boolean);

                if (aContact.length) {
                    pdf.setFont("times", "normal");
                    pdf.setFontSize(10);

                    var sContactLine = aContact.join(" | ");
                    var aContactLines = pdf.splitTextToSize(sContactLine, 160);

                    pdf.text(aContactLines, center, y + 6, { align: "center" });
                    y += (aContactLines.length * 5) + 4;
                } else {
                    y += 8;
                }

                var aLinks = [
                    this._sanitizeText(profile.linkedinUrl),
                    this._sanitizeText(profile.githubUrl)
                ].filter(Boolean);

                if (aLinks.length) {
                    drawSectionTitle("Websites personales");
                    addBulletList(aLinks, 22, 160);
                    y += 2;
                }

                if (profile.summary) {
                    drawSectionTitle("Sobre mi");
                    pdf.setFont("times", "normal");
                    pdf.setFontSize(10);
                    y = this._addWrappedText(
                        pdf,
                        this._sanitizeText(profile.summary),
                        20,
                        y,
                        170,
                        5
                    );
                    y += 2;
                }

                if (skills.length) {
                    drawSectionTitle("Skills");

                    var aSkillTexts = skills.map(function (s) {
                        var sName = this._sanitizeText(s.name);
                        var sCategory = this._sanitizeText(s.category);
                        return sCategory ? (sName + " (" + sCategory + ")") : sName;
                    }.bind(this));

                    var aCol1 = [];
                    var aCol2 = [];

                    aSkillTexts.forEach(function (sText, i) {
                        if (i % 2 === 0) {
                            aCol1.push(sText);
                        } else {
                            aCol2.push(sText);
                        }
                    });

                    var iMax = Math.max(aCol1.length, aCol2.length);

                    for (var i = 0; i < iMax; i++) {
                        y = this._ensurePageSpace(pdf, y, 7);
                        pdf.setFont("times", "normal");
                        pdf.setFontSize(10);

                        if (aCol1[i]) {
                            pdf.text("•", 20, y);
                            pdf.text(aCol1[i], 24, y);
                        }

                        if (aCol2[i]) {
                            pdf.text("•", 108, y);
                            pdf.text(aCol2[i], 112, y);
                        }

                        y += 6;
                    }
                }

                if (experiences.length) {
                    drawSectionTitle("Trayectoria profesional");

                    experiences.forEach(function (exp) {
                        var sRole = this._sanitizeText(exp.role);
                        var sCompany = this._sanitizeText(exp.company);
                        var sLocation = this._sanitizeText(exp.location);
                        var sDateRange = this._formatDateRange(exp.startDate, exp.endDate);
                        var sDescription = this._sanitizeText(exp.description);
                        var sTech = this._sanitizeText(exp.technologies);

                        y = this._ensurePageSpace(pdf, y, 18);

                        pdf.setFont("times", "bold");
                        pdf.setFontSize(11);
                        pdf.text(sRole || "-", 20, y);

                        if (sDateRange) {
                            pdf.setFont("times", "normal");
                            pdf.setFontSize(10);
                            pdf.text(sDateRange, right, y, { align: "right" });
                        }

                        y += 5;

                        pdf.setFont("times", "bolditalic");
                        pdf.setFontSize(10);
                        pdf.text(
                            [sCompany, sLocation].filter(Boolean).join(" - "),
                            20,
                            y
                        );

                        y += 5;

                        var aBullets = this._extractBulletLines(sDescription);
                        if (!aBullets.length && sDescription) {
                            aBullets = this._splitLongTextAsBullets(sDescription);
                        }

                        if (aBullets.length) {
                            addBulletList(aBullets, 24, 156);
                        } else if (sDescription) {
                            pdf.setFont("times", "normal");
                            pdf.setFontSize(10);
                            y = this._addWrappedText(pdf, sDescription, 20, y, 170, 5);
                        }

                        if (sTech) {
                            y = this._ensurePageSpace(pdf, y, 8);
                            pdf.setFont("times", "italic");
                            pdf.setFontSize(10);
                            y = this._addWrappedText(
                                pdf,
                                "Tecnologías: " + sTech,
                                20,
                                y,
                                170,
                                5
                            );
                        }

                        y += 4;
                    }.bind(this));
                }

                if (education.length) {
                    drawSectionTitle("Educación");

                    education.forEach(function (ed) {
                        var sDegree = this._sanitizeText(ed.degree);
                        var sInstitution = this._sanitizeText(ed.institution);
                        var sYears = [ed.startYear, ed.endYear].filter(Boolean).join(" - ");

                        y = this._ensurePageSpace(pdf, y, 12);

                        pdf.setFont("times", "bold");
                        pdf.setFontSize(11);
                        pdf.text(sDegree || "-", 20, y);

                        if (sYears) {
                            pdf.setFont("times", "normal");
                            pdf.setFontSize(10);
                            pdf.text(sYears, right, y, { align: "right" });
                        }

                        y += 5;

                        if (sInstitution) {
                            pdf.setFont("times", "bold");
                            pdf.setFontSize(10);
                            pdf.text(sInstitution, 20, y);
                            y += 7;
                        }
                    }.bind(this));
                }

                if (certifications.length) {
                    drawSectionTitle("Capacitaciones");

                    certifications.forEach(function (c) {
                        var sCert = this._sanitizeText(c.name);
                        var sOrg = this._sanitizeText(c.issuingOrg);
                        var sYear = this._sanitizeText(c.issueYear);

                        var sLine = sCert;
                        if (sYear) {
                            sLine += " - " + sYear;
                        }
                        if (sOrg) {
                            sLine += " - " + sOrg;
                        }

                        y = this._ensurePageSpace(pdf, y, 7);
                        pdf.setFont("times", "normal");
                        pdf.setFontSize(10);

                        pdf.text("•", 20, y);
                        var aLines = pdf.splitTextToSize(sLine, 165);
                        pdf.text(aLines, 24, y);
                        y += aLines.length * 4.8;
                    }.bind(this));
                }

                if (languages.length) {
                    drawSectionTitle("Idiomas");

                    var aLang1 = [];
                    var aLang2 = [];

                    languages.forEach(function (l, i) {
                        var sLanguage = this._sanitizeText(l.language);
                        var sProf = this._sanitizeText(l.proficiency);
                        var sText = sProf ? (sLanguage + " (" + sProf + ")") : sLanguage;

                        if (i % 2 === 0) {
                            aLang1.push(sText);
                        } else {
                            aLang2.push(sText);
                        }
                    }.bind(this));

                    var iLangMax = Math.max(aLang1.length, aLang2.length);

                    for (var j = 0; j < iLangMax; j++) {
                        y = this._ensurePageSpace(pdf, y, 7);
                        pdf.setFont("times", "normal");
                        pdf.setFontSize(10);

                        if (aLang1[j]) {
                            pdf.text(aLang1[j], 20, y);
                        }

                        if (aLang2[j]) {
                            pdf.text(aLang2[j], 108, y);
                        }

                        y += 6;
                    }
                }

                var sFileName = [
                    profile.firstName || "CV",
                    profile.lastName || ""
                ].join("_").replace(/\s+/g, "_").replace(/[^\w\-]/g, "");

                pdf.save((sFileName || "CV") + "_2026.pdf");
            } catch (oError) {
                console.error("Error generando PDF:", oError);
                MessageToast.show("No se pudo generar el PDF");
            }
        },

        onOpenProject: function (oEvent) {
            var oCtx = oEvent.getSource().getBindingContext("cv");
            var sUrl = oCtx.getProperty("projectUrl");
            if (sUrl) {
                window.open(sUrl, "_blank");
            }
        },

        onLinkedIn: function () {
            var sUrl = this.getView().getModel("cv").getProperty("/profile/linkedinUrl");
            if (sUrl) {
                window.open(sUrl, "_blank");
            } else {
                MessageToast.show("LinkedIn no configurado");
            }
        },

        onGitHub: function () {
            var sUrl = this.getView().getModel("cv").getProperty("/profile/githubUrl");
            if (sUrl) {
                window.open(sUrl, "_blank");
            } else {
                MessageToast.show("GitHub no configurado");
            }
        },

        onAboutApp: function () {
            if (this._oAboutDialog) {
                this._oAboutDialog.open();
                return;
            }

            var oIntroTitle = new Title({
                text: "CV Viewer sobre SAP BTP",
                level: "H4"
            }).addStyleClass("cvAboutMainTitle");

            var oIntroText = new Text({
                text: "Aplicación desarrollada como portfolio técnico para mostrar una solución full-stack dentro del ecosistema SAP. Permite administrar y visualizar un CV profesional con información dinámica persistida en base de datos."
            }).addStyleClass("cvAboutIntroText");

            var oContent = new VBox({
                items: [
                    oIntroTitle,
                    oIntroText,
                    this._createAboutRow(
                        "sap-icon://target-group",
                        "Propósito",
                        "Fue pensada para demostrar una aplicación real construida con tecnologías SAP modernas, con foco en experiencia visual, persistencia, arquitectura limpia y despliegue en la nube."
                    ),
                    this._createAboutRow(
                        "sap-icon://process",
                        "Tecnologías",
                        "Frontend en SAP UI5, backend en SAP CAP con Node.js, autenticación con XSUAA, despliegue en SAP BTP Cloud Foundry y persistencia en PostgreSQL."
                    ),
                    this._createAboutRow(
                        "sap-icon://split",
                        "Arquitectura",
                        "La solución se compone de un approuter, un frontend UI5, un backend CAP y una base PostgreSQL. El frontend consume servicios públicos del backend para renderizar toda la información del perfil."
                    ),
                    this._createAboutRow(
                        "sap-icon://developer-settings",
                        "Construcción del proyecto",
                        "El proyecto incluye un wizard de administración para cargar y actualizar la información del CV, y una vista pública orientada a portfolio para mostrar skills, experiencia, proyectos, educación, certificaciones e idiomas."
                    )
                ]
            }).addStyleClass("cvAboutDialogContent sapUiContentPadding");

            this._oAboutDialog = new Dialog({
                title: "Acerca de la app",
                contentWidth: "700px",
                horizontalScrolling: false,
                verticalScrolling: true,
                content: [oContent],
                beginButton: new Button({
                    text: "Cerrar",
                    press: function () {
                        this._oAboutDialog.close();
                    }.bind(this)
                })
            });

            this.getView().addDependent(this._oAboutDialog);
            this._oAboutDialog.open();
        },

        _createAboutRow: function (sIcon, sTitle, sText) {
            var oIcon = new Icon({
                src: sIcon
            }).addStyleClass("cvAboutRowIcon");

            var oTitle = new Title({
                text: sTitle,
                level: "H5"
            }).addStyleClass("cvAboutRowTitle");

            var oText = new Text({
                text: sText
            }).addStyleClass("cvAboutRowText");

            var oTextBox = new VBox({
                items: [oTitle, oText]
            }).addStyleClass("cvAboutRowTextBox");

            return new HBox({
                alignItems: "Start",
                items: [oIcon, oTextBox]
            }).addStyleClass("cvAboutRow");
        }
    });
});