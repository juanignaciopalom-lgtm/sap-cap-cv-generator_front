sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/odata/v4/ODataModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageToast"
], function (Controller, JSONModel, ODataModel, Filter, FilterOperator, MessageToast) {
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
                        oModel.setProperty("/skills", aResults[0].map(function (c) { return c.getObject(); }));
                        oModel.setProperty("/experiences", aResults[1].map(function (c) { return c.getObject(); }));
                        oModel.setProperty("/projects", aResults[2].map(function (c) { return c.getObject(); }));
                        oModel.setProperty("/education", aResults[3].map(function (c) { return c.getObject(); }));

                        var aCerts = aResults[4].map(function (c) { return c.getObject(); });
                        aCerts.sort(function (a, b) {
                            return (b.issueYear || 0) - (a.issueYear || 0);
                        });
                        oModel.setProperty("/certifications", aCerts);

                        oModel.setProperty("/languages", aResults[5].map(function (c) { return c.getObject(); }));

                        that._snapInitialized = false;
                        setTimeout(function () { that._initSnapScroll(); }, 600);
                    });
                })
                .catch(function (oError) {
                    console.error("Error:", oError);
                });

            this.getView().addEventDelegate({
                onAfterRendering: function () {
                    setTimeout(function () { that._initSnapScroll(); }, 300);
                }
            });
        },

        _initSnapScroll: function () {
            if (this._snapInitialized) return;

            var oPageDom = this.byId("page").getDomRef();
            if (!oPageDom) return;

            var oScroller = oPageDom.querySelector(".sapMPageScroll");
            if (!oScroller) return;

            var aSections = Array.from(
                oScroller.querySelectorAll(".cvSnapSection")
            ).filter(function (el) {
                return el.offsetHeight > 0;
            });

            if (!aSections.length) return;

            this._snapInitialized = true;
            var bScrolling = false;

            var fnGetCurrent = function () {
                var iScrollTop = oScroller.scrollTop;
                var iBest = 0;
                var iMin = Infinity;
                aSections.forEach(function (oSec, i) {
                    var iDist = Math.abs(oSec.offsetTop - iScrollTop);
                    if (iDist < iMin) { iMin = iDist; iBest = i; }
                });
                return iBest;
            };

            var fnScrollTo = function (iIndex) {
                if (iIndex < 0 || iIndex >= aSections.length) return;
                bScrolling = true;
                aSections[iIndex].scrollIntoView({ behavior: "smooth", block: "start" });
                setTimeout(function () { bScrolling = false; }, 900);
            };

            oScroller.addEventListener("wheel", function (oEvent) {
                oEvent.preventDefault();
                if (bScrolling) return;
                fnScrollTo(oEvent.deltaY > 0 ? fnGetCurrent() + 1 : fnGetCurrent() - 1);
            }, { passive: false });

            var iTouchStartY = 0;
            oScroller.addEventListener("touchstart", function (oEvent) {
                iTouchStartY = oEvent.touches[0].clientY;
            }, { passive: true });

            oScroller.addEventListener("touchend", function (oEvent) {
                if (bScrolling) return;
                var iDelta = iTouchStartY - oEvent.changedTouches[0].clientY;
                if (Math.abs(iDelta) < 40) return;
                fnScrollTo(iDelta > 0 ? fnGetCurrent() + 1 : fnGetCurrent() - 1);
            }, { passive: true });

            document.addEventListener("keydown", function (oEvent) {
                if (bScrolling) return;
                if (oEvent.key === "ArrowDown" || oEvent.key === "PageDown") {
                    oEvent.preventDefault();
                    fnScrollTo(fnGetCurrent() + 1);
                } else if (oEvent.key === "ArrowUp" || oEvent.key === "PageUp") {
                    oEvent.preventDefault();
                    fnScrollTo(fnGetCurrent() - 1);
                }
            });
        },

        onOpenProject: function (oEvent) {
            var oCtx = oEvent.getSource().getBindingContext("cv");
            var sUrl = oCtx.getProperty("projectUrl");
            if (sUrl) { window.open(sUrl, "_blank"); }
        },

        onLinkedIn: function () {
            var sUrl = this.getView().getModel("cv").getProperty("/profile/linkedinUrl");
            if (sUrl) { window.open(sUrl, "_blank"); }
            else { MessageToast.show("LinkedIn no configurado"); }
        },

        onGitHub: function () {
            var sUrl = this.getView().getModel("cv").getProperty("/profile/githubUrl");
            if (sUrl) { window.open(sUrl, "_blank"); }
            else { MessageToast.show("GitHub no configurado"); }
        }
    });
});