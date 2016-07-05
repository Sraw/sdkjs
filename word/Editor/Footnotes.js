/*
 * (c) Copyright Ascensio System SIA 2010-2016
 *
 * This program is a free software product. You can redistribute it and/or
 * modify it under the terms of the GNU Affero General Public License (AGPL)
 * version 3 as published by the Free Software Foundation. In accordance with
 * Section 7(a) of the GNU AGPL its Section 15 shall be amended to the effect
 * that Ascensio System SIA expressly excludes the warranty of non-infringement
 * of any third-party rights.
 *
 * This program is distributed WITHOUT ANY WARRANTY; without even the implied
 * warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR  PURPOSE. For
 * details, see the GNU AGPL at: http://www.gnu.org/licenses/agpl-3.0.html
 *
 * You can contact Ascensio System SIA at Lubanas st. 125a-25, Riga, Latvia,
 * EU, LV-1021.
 *
 * The  interactive user interfaces in modified source and object code versions
 * of the Program must display Appropriate Legal Notices, as required under
 * Section 5 of the GNU AGPL version 3.
 *
 * Pursuant to Section 7(b) of the License you must retain the original Product
 * logo when distributing the program. Pursuant to Section 7(e) we decline to
 * grant you any rights under trademark law for use of our trademarks.
 *
 * All the Product's GUI elements, including illustrations and icon sets, as
 * well as technical writing content are licensed under the terms of the
 * Creative Commons Attribution-ShareAlike 4.0 International. See the License
 * terms at http://creativecommons.org/licenses/by-sa/4.0/legalcode
 *
 */

"use strict";

/**
 * Класс, работающий со сносками документа.
 * @param {CDocument} LogicDocument - Ссылка на главный документ.
 * @constructor
 * @extends {CDocumentControllerBase}
 */
function CFootnotesController(LogicDocument)
{
	CFootnotesController.superclass.constructor.call(this, LogicDocument);

	this.Id = LogicDocument.Get_IdCounter().Get_NewId();

	this.Footnote = {}; // Список всех сносок с ключом - Id.
	this.Pages    = [];

	// Специальные сноски
	this.ContinuationNoticeFootnote    = null;
	this.ContinuationSeparatorFootnote = null;
	this.SeparatorFootnote             = null;

	this.Selection = {
		Use       : false,
		Start     : {
			Footnote   : null,
			Page       : 0,
			Index      : 0
		},
		End       : {
			Footnote   : null,
			Page       : 0,
			Index      : 0
		},
		Footnotes : {},
		Direction : 0
	};

	this.CurFootnote = null;

	// Добавляем данный класс в таблицу Id (обязательно в конце конструктора)
	LogicDocument.Get_TableId().Add(this, this.Id);
}

AscCommon.extendClass(CFootnotesController, CDocumentControllerBase);

/**
 * Получаем Id данного класса.
 */
CFootnotesController.prototype.Get_Id = function()
{
	return this.Id;
};
/**
 * Начальная инициализация после загрузки всех файлов.
 */
CFootnotesController.prototype.Init = function()
{
	this.SeparatorFootnote = new CFootEndnote(this);
	this.SeparatorFootnote.Paragraph_Add(new ParaSeparator(), false);
	var oParagraph = this.SeparatorFootnote.Get_ElementByIndex(0);
	oParagraph.Set_Spacing({After : 0, Line : 1, LineRule : Asc.linerule_Auto}, false);
};
/**
 * Создаем новую сноску.
 * @returns {CFootEndnote}
 */
CFootnotesController.prototype.Create_Footnote = function()
{
	var NewFootnote                     = new CFootEndnote(this);
	this.Footnote[NewFootnote.Get_Id()] = NewFootnote;


	var oHistory = this.LogicDocument.Get_History();
	oHistory.Add(this, {Type : AscDFH.historyitem_Footnotes_AddFootnote, Id : NewFootnote.Get_Id()});

	return NewFootnote;
};
/**
 * Сбрасываем рассчетные данный для заданной страницы.
 * @param {number} nPageIndex
 */
CFootnotesController.prototype.Reset = function(nPageIndex)
{
	if (!this.Pages[nPageIndex])
		this.Pages[nPageIndex] = new CFootEndnotePage();

	this.Pages[nPageIndex].Reset();
};
/**
 * Пересчитываем сноски на заданной странице.
 */
CFootnotesController.prototype.Recalculate = function(nPageIndex, X, XLimit, Y, YLimit)
{
	if (!this.Pages[nPageIndex])
		this.Pages[nPageIndex] = new CFootEndnotePage();

	if (true === this.Is_EmptyPage(nPageIndex))
		return;

	// Мы пересчет начинаем с 0, потом просто делаем сдвиг, через функцию Shift.

	var CurY = Y;

	if (null !== this.SeparatorFootnote)
	{
		this.SeparatorFootnote.Prepare_RecalculateObject();
		this.SeparatorFootnote.Reset(X, CurY, XLimit, 10000);
		this.SeparatorFootnote.Set_StartPage(nPageIndex);
		this.SeparatorFootnote.Recalculate_Page(0, true);
		this.Pages[nPageIndex].SeparatorRecalculateObject = this.SeparatorFootnote.Save_RecalculateObject();

		var Bounds = this.SeparatorFootnote.Get_PageBounds(0);
		CurY += Bounds.Bottom - Bounds.Top;
	}

	for (var nIndex = 0; nIndex < this.Pages[nPageIndex].Elements.length; ++nIndex)
	{
		var Footnote = this.Pages[nPageIndex].Elements[nIndex];
		Footnote.Reset(X, CurY, XLimit, 10000);
		Footnote.Set_StartPage(nPageIndex);

		var CurPage      = 0;
		var RecalcResult = recalcresult2_NextPage;
		while (recalcresult2_End != RecalcResult)
			RecalcResult = Footnote.Recalculate_Page(CurPage++, true);

		var Bounds = Footnote.Get_PageBounds(0);
		CurY += Bounds.Bottom - Bounds.Top;
	}
};
/**
 * Получаем суммарную высоту, занимаемую сносками на заданной странице.
 * @param {number} nPageIndex
 * @returns {number}
 */
CFootnotesController.prototype.Get_Height = function(nPageIndex)
{
	if (true === this.Is_EmptyPage(nPageIndex))
		return 0;

	var nHeight = 0;

	if (null !== this.SeparatorFootnote)
	{
		var Bounds = this.SeparatorFootnote.Get_PageBounds(0);
		nHeight += Bounds.Bottom - Bounds.Top;
	}

	for (var nIndex = 0; nIndex < this.Pages[nPageIndex].Elements.length; ++nIndex)
	{
		var Footnote = this.Pages[nPageIndex].Elements[nIndex];
		var Bounds   = Footnote.Get_PageBounds(0);
		nHeight += Bounds.Bottom - Bounds.Top;
	}

	return nHeight;
};
/**
 * Отрисовываем сноски на заданной странице.
 * @param {number} nPageIndex
 * @param {CGraphics} pGraphics
 */
CFootnotesController.prototype.Draw = function(nPageIndex, pGraphics)
{
	if (true === this.Is_EmptyPage(nPageIndex))
		return;

	if (null !== this.SeparatorFootnote && null !== this.Pages[nPageIndex].SeparatorRecalculateObject)
	{
		this.SeparatorFootnote.Load_RecalculateObject(this.Pages[nPageIndex].SeparatorRecalculateObject);
		this.SeparatorFootnote.Draw(nPageIndex, pGraphics);
	}

	for (var nIndex = 0; nIndex < this.Pages[nPageIndex].Elements.length; ++nIndex)
	{
		var Footnote = this.Pages[nPageIndex].Elements[nIndex];
		Footnote.Draw(nPageIndex, pGraphics);
	}
};
/**
 * Сдвигаем все рассчитанные позиции на заданной странице.
 * @param {number} nPageIndex
 * @param {number} dX
 * @param {number} dY
 */
CFootnotesController.prototype.Shift = function(nPageIndex, dX, dY)
{
	if (true === this.Is_EmptyPage(nPageIndex))
		return;

	if (null !== this.SeparatorFootnote && null !== this.Pages[nPageIndex].SeparatorRecalculateObject)
	{
		this.SeparatorFootnote.Load_RecalculateObject(this.Pages[nPageIndex].SeparatorRecalculateObject);
		this.SeparatorFootnote.Shift(0, dX, dY);
		this.Pages[nPageIndex].SeparatorRecalculateObject = this.SeparatorFootnote.Save_RecalculateObject();
	}

	for (var nIndex = 0; nIndex < this.Pages[nPageIndex].Elements.length; ++nIndex)
	{
		var Footnote = this.Pages[nPageIndex].Elements[nIndex];
		Footnote.Shift(0, dX, dY);
	}
};
/**
 * Добавляем заданную сноску на страницу для пересчета.
 * @param {number} nPageIndex
 * @param {CFootEndnote} oFootnote
 */
CFootnotesController.prototype.Add_FootnoteOnPage = function(nPageIndex, oFootnote)
{
	if (!this.Pages[nPageIndex])
		this.Pages[nPageIndex] = new CFootEndnotePage();

	this.Pages[nPageIndex].Elements.push(oFootnote);
};
/**
 * Проверяем, используется заданная сноска в документе.
 * @param {string} sFootnoteId
 * @returns {boolean}
 */
CFootnotesController.prototype.Is_UseInDocument = function(sFootnoteId)
{
	// TODO: Надо бы еще проверить, если ли в документе ссылка на данную сноску.
	for (var sId in this.Footnote)
	{
		if (sId === sFootnoteId)
			return true;
	}

	return false;
};
/**
 * Проверяем пустая ли страница.
 * @param {number} nPageIndex
 * @returns {boolean}
 */
CFootnotesController.prototype.Is_EmptyPage = function(nPageIndex)
{
	if (!this.Pages[nPageIndex] || this.Pages[nPageIndex].Elements.length <= 0)
		return true;

	return false;
};
CFootnotesController.prototype.Refresh_RecalcData = function(Data)
{
};
CFootnotesController.prototype.Refresh_RecalcData2 = function(nRelPageIndex)
{
	var nAbsPageIndex = nRelPageIndex;
	if (this.LogicDocument.Pages[nAbsPageIndex])
	{
		var nIndex = this.LogicDocument.Pages[nAbsPageIndex].Pos;
		this.LogicDocument.Refresh_RecalcData2(nIndex, nAbsPageIndex);
	}
};
CFootnotesController.prototype.Get_PageContentStartPos = function(PageAbs)
{
	//TODO: Реализовать
	return {X : 0, Y : 0, XLimit : 0, YLimit : 0};
};
/**
 * Проверяем попадание в сноски на заданной странице.
 * @param X
 * @param Y
 * @param PageAbs
 * @returns {boolean}
 */
CFootnotesController.prototype.CheckHitInFootnote = function(X, Y, PageAbs)
{
	if (true === this.Is_EmptyPage(PageAbs))
		return false;

	var Page = this.Pages[PageAbs];
	for (var nIndex = 0; nIndex < Page.Elements.length; ++nIndex)
	{
		var Footnote = Page.Elements[nIndex];
		var Bounds   = Footnote.Get_PageBounds(0);

		if (Bounds.Top <= Y)
			return true;
	}


	return false;
};
CFootnotesController.prototype.StartSelection = function(X, Y, PageAbs, MouseEvent)
{
	if (true === this.Selection.Use)
		this.RemoveSelection();

	var oResult = this.private_GetFootnoteByXY(X, Y, PageAbs);
	if (null === oResult)
	{
		// BAD
		this.Selection.Use = false;
		return;
	}

	this.Selection.Use   = true;
	this.Selection.Start = oResult;
	this.Selection.End   = oResult;

	this.Selection.Start.Footnote.Selection_SetStart(X, Y, 0, MouseEvent);

	this.CurFootnote = this.Selection.Start.Footnote;

	this.Selection.Footnotes = {};
	this.Selection.Footnotes[this.Selection.Start.Footnote.Get_Id()] = this.Selection.Start.Footnote;
	this.Selection.Direction = 0;
};
CFootnotesController.prototype.EndSelection = function(X, Y, PageAbs, MouseEvent)
{
	var oResult = this.private_GetFootnoteByXY(X, Y, PageAbs);
	if (null === oResult)
	{
		// BAD
		this.Selection.Use = false;
		return;
	}

	this.Selection.End = oResult;
	this.CurFootnote = this.Selection.End.Footnote;

	var sStartId = this.Selection.Start.Footnote.Get_Id();
	var sEndId   = this.Selection.End.Footnote.Get_Id();

	// Очищаем старый селект везде кроме начальной сноски
	for (var sFootnoteId in this.Selection.Footnotes)
	{
		if (sFootnoteId !== sStartId)
			this.Selection.Footnotes[sFootnoteId].Selection_Remove();
	}

	// Новый селект
	if (this.Selection.Start.Footnote !== this.Selection.End.Footnote)
	{
		if (this.Selection.Start.Page > this.Selection.End.Page || this.Selection.Start.Index > this.Selection.End.Index)
		{
			this.Selection.Start.Footnote.Selection_SetEnd(-MEASUREMENT_MAX_MM_VALUE, -MEASUREMENT_MAX_MM_VALUE, 0, MouseEvent);
			this.Selection.End.Footnote.Selection_SetStart(MEASUREMENT_MAX_MM_VALUE, MEASUREMENT_MAX_MM_VALUE, 0, MouseEvent);
			this.Selection.Direction = -1;
		}
		else
		{
			this.Selection.Start.Footnote.Selection_SetEnd(MEASUREMENT_MAX_MM_VALUE, MEASUREMENT_MAX_MM_VALUE, 0, MouseEvent);
			this.Selection.End.Footnote.Selection_SetStart(-MEASUREMENT_MAX_MM_VALUE, -MEASUREMENT_MAX_MM_VALUE, 0, MouseEvent);
			this.Selection.Direction = 1;
		}
		this.Selection.End.Footnote.Selection_SetEnd(X, Y, 0, MouseEvent);

		var oRange = this.private_GetFootnotesRange(this.Selection.Start, this.Selection.End);
		for (var sFootnoteId in oRange)
		{
			if (sFootnoteId !== sStartId && sFootnoteId !== sEndId)
			{
				var oFootnote = oRange[sFootnoteId];
				oFootnote.Select_All();
			}
		}
		this.Selection.Footnotes = oRange;
	}
	else
	{
		this.Selection.End.Footnote.Selection_SetEnd(X, Y, 0, MouseEvent);
		this.Selection.Footnotes = {};
		this.Selection.Footnotes[this.Selection.Start.Footnote.Get_Id()] = this.Selection.Start.Footnote;
		this.Selection.Direction = 0;
	}
};
CFootnotesController.prototype.Undo = function()
{
	var Type = Data.Type;

	switch (Type)
	{
		case AscDFH.historyitem_Footnotes_AddFootnote:
		{
			this.Footnote[Data.Id] = g_oTableId.Get_ById(Data.Id);
			break;
		}
	}
};
CFootnotesController.prototype.Redo = function()
{
	var Type = Data.Type;

	switch (Type)
	{
		case AscDFH.historyitem_Footnotes_AddFootnote:
		{
			delete this.Footnote[Data.Id];
			break;
		}
	}
};
CFootnotesController.prototype.Save_Changes = function(Data, Writer)
{
	// Сохраняем изменения из тех, которые используются для Undo/Redo в бинарный файл.
	// Long : тип класса
	// Long : тип изменений

	Writer.WriteLong(AscDFH.historyitem_type_Footnotes);

	var Type = Data.Type;

	// Пишем тип
	Writer.WriteLong(Type);

	switch (Type)
	{
		case  AscDFH.historyitem_Footnotes_AddFootnote:
		{
			// String : Id
			Writer.WriteString2(Data.Id);
			break;
		}
	}

	return Writer;
};
CFootnotesController.prototype.Save_Changes2 = function(Data, Writer)
{
};
CFootnotesController.prototype.Load_Changes = function(Reader, Reader2)
{
	// Сохраняем изменения из тех, которые используются для Undo/Redo в бинарный файл.
	// Long : тип класса
	// Long : тип изменений

	var ClassType = Reader.GetLong();
	if (AscDFH.historyitem_type_Footnotes != ClassType)
		return;

	var Type = Reader.GetLong();

	switch (Type)
	{
		case  AscDFH.historyitem_Footnotes_AddFootnote:
		{
			// String : Id
			var Id = Reader.GetString2();
			this.Footnote[Id] = g_oTableId.Get_ById(Id);
			break;
		}
	}

	return true;
};
CFootnotesController.prototype.Set_CurrentElement = function(bUpdateStates, PageAbs, oFootnote)
{
	if (oFootnote instanceof CFootEndnote)
	{
		this.private_SetCurrentFootnoteNoSelection(oFootnote);
		this.LogicDocument.Set_DocPosType(docpostype_Footnotes);

		if (false != bUpdateStates)
		{
			this.LogicDocument.Document_UpdateInterfaceState();
			this.LogicDocument.Document_UpdateRulersState();
			this.LogicDocument.Document_UpdateSelectionState();
		}
	}
};
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Private area
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
CFootnotesController.prototype.private_GetFootnoteOnPageByXY = function(X, Y, PageAbs)
{
	if (true === this.Is_EmptyPage(PageAbs))
		return null;

	var Page = this.Pages[PageAbs];
	for (var nIndex = Page.Elements.length - 1; nIndex >= 0; --nIndex)
	{
		var Footnote = Page.Elements[nIndex];
		var Bounds   = Footnote.Get_PageBounds(0);

		if (Bounds.Top <= Y || 0 === nIndex)
			return {
				Footnote : Footnote,
				Index    : nIndex,
				Page     : PageAbs
			};
	}



	return null;
};
CFootnotesController.prototype.private_GetFootnoteByXY = function(X, Y, PageAbs)
{
	var oResult = this.private_GetFootnoteOnPageByXY(X, Y, PageAbs);
	if (null !== oResult)
		return oResult;

	var nCurPage = PageAbs - 1;
	while (nCurPage >= 0)
	{
		oResult = this.private_GetFootnoteOnPageByXY(MEASUREMENT_MAX_MM_VALUE, MEASUREMENT_MAX_MM_VALUE, nCurPage);
		if (null !== oResult)
			return oResult;

		nCurPage--;
	}

	nCurPage = PageAbs + 1;
	while (nCurPage < this.Pages.length)
	{
		oResult = this.private_GetFootnoteOnPageByXY(-MEASUREMENT_MAX_MM_VALUE, -MEASUREMENT_MAX_MM_VALUE, nCurPage);
		if (null !== oResult)
			return oResult;

		nCurPage++;
	}

	return null;
};
CFootnotesController.prototype.private_GetFootnotesRange = function(Start, End)
{
	var oResult = [];
	if (Start.Page > End.Page)
	{
		var Temp = Start;
		Start    = End;
		End      = Temp;
	}

	if (Start.Page === End.Page)
	{
		if (Start.Index <= End.Index)
			this.private_GetFootnotesOnPage(Start.Page, Start.Index, End.Index, oResult);
		else
			this.private_GetFootnotesOnPage(Start.Page, End.Index, Start.Index, oResult);
	}
	else
	{
		this.private_GetFootnotesOnPage(Start.Page, Start.Index, -1, oResult);

		for (var CurPage = Start.Page + 1; CurPage <= End.Page - 1; ++CurPage)
		{
			this.private_GetFootnotesOnPage(CurPage, -1, -1, oResult);
		}

		this.private_GetFootnotesOnPage(End.Page, -1, End.Index, oResult);
	}

	return oResult;
};
CFootnotesController.prototype.private_GetFootnotesOnPage = function(PageAbs, StartIndex, EndIndex, oFootnotes)
{
	var Page = this.Pages[PageAbs];
	var _StartIndex = -1 === StartIndex ? 0 : StartIndex;
	var _EndIndex   = -1 === EndIndex ? Page.Elements.length - 1 : EndIndex;
	for (var nIndex = _StartIndex; nIndex <= _EndIndex; ++nIndex)
	{
		var oFootnote = Page.Elements[nIndex];
		oFootnotes[oFootnote.Get_Id()] = oFootnote;
	}
};
CFootnotesController.prototype.private_OnNotValidActionForFootnotes = function()
{
	// Пока ничего не делаем, если надо будет выдавать сообщение, то обработать нужно будет здесь.
};
CFootnotesController.prototype.private_IsOnFootnoteSelected = function()
{
	// TODO: Заменить на this.Selection.Direction и проверить
	var nCounter = 0;
	for (var sId in this.Selection.Footnotes)
	{
		nCounter++;

		if (nCounter > 1)
			return false;
	}

	return true;
};
CFootnotesController.prototype.private_CheckFootnotesSelectionBeforeAction = function()
{
	if (true !== this.private_IsOnFootnoteSelected() || null === this.CurFootnote)
	{
		this.private_OnNotValidActionForFootnotes();
		return false;
	}

	return true;
};
CFootnotesController.prototype.private_SetCurrentFootnoteNoSelection = function(oFootnote)
{
	this.Selection.Use            = false;
	this.CurFootnote              = oFootnote;
	this.Selection.Start.Footnote = oFootnote;
	this.Selection.End.Footnote   = oFootnote;
	this.Selection.Direction      = 0;

	this.Selection.Footnotes                     = {};
	this.Selection.Footnotes[oFootnote.Get_Id()] = oFootnote;
};
CFootnotesController.prototype.private_GetPrevFootnote = function(oFootnote)
{
	if (!oFootnote)
		return null;

	var arrList = this.LogicDocument.Get_FootnotesList(null, oFootnote);
	if (!arrList || arrList.length <= 1 || arrList[arrList.length - 1] !== oFootnote)
		return null;

	return arrList[arrList.length - 2];
};
CFootnotesController.prototype.private_GetNextFootnote = function(oFootnote)
{
	if (!oFootnote)
		return null;

	var arrList = this.LogicDocument.Get_FootnotesList(oFootnote, null);
	if (!arrList || arrList.length <= 1 || arrList[0] !== oFootnote)
		return null;

	return arrList[1];
};
CFootnotesController.prototype.private_GetDirection = function(oFootnote1, oFootnote2)
{
	// Предполагается, что эти сноски обязательно есть в документе
	if (oFootnote1 == oFootnote2)
		return 0;

	var arrList = this.LogicDocument.Get_FootnotesList(null, null);

	for (var nPos = 0, nCount = arrList.length; nPos < nCount; ++nPos)
	{
		if (oFootnote1 === arrList[nPos])
			return 1;
		else if (oFootnote2 === arrList[nPos])
			return -1;
	}

	return 0;
};
CFootnotesController.prototype.private_GetFootnotesLogicRange = function(oFootnote1, oFootnote2)
{
	return this.LogicDocument.Get_FootnotesList(oFootnote1, oFootnote2);
};
CFootnotesController.prototype.private_GetSelectionArray = function()
{
	if (true !== this.Selection.Use || 0 === this.Selection.Direction)
		return [this.CurFootnote];

	if (1 === this.Selection.Direction)
		return this.private_GetFootnotesLogicRange(this.Selection.Start.Footnote, this.Selection.End.Footnote);
	else
		return this.private_GetFootnotesLogicRange(this.Selection.End.Footnote, this.Selection.Start.Footnote);
};
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Controller area
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
CFootnotesController.prototype.CanTargetUpdate = function()
{
	return true;
};
CFootnotesController.prototype.RecalculateCurPos = function()
{
	if (null !== this.CurFootnote)
		return this.CurFootnote.RecalculateCurPos();

	return {X : 0, Y : 0, Height : 0, PageNum : 0, Internal : {Line : 0, Page : 0, Range : 0}, Transform : null};
};
CFootnotesController.prototype.GetCurPage = function()
{
	if (null !== this.CurFootnote)
		return this.CurFootnote.Get_StartPage_Absolute();

	return -1;
};
CFootnotesController.prototype.AddNewParagraph = function(bRecalculate, bForceAdd)
{
	if (false === this.private_CheckFootnotesSelectionBeforeAction())
		return false;

	return this.CurFootnote.Add_NewParagraph(bRecalculate, bForceAdd);
};
CFootnotesController.prototype.AddInlineImage = function(nW, nH, oImage, oChart, bFlow)
{
	if (false === this.private_CheckFootnotesSelectionBeforeAction())
		return false;

	return this.CurFootnote.Add_InlineImage(nW, nH, oImage, oChart, bFlow);
};
CFootnotesController.prototype.AddOleObject = function(W, H, nWidthPix, nHeightPix, Img, Data, sApplicationId)
{
	if (false === this.private_CheckFootnotesSelectionBeforeAction())
		return false;

	return this.CurFootnote.Add_OleObject(W, H, nWidthPix, nHeightPix, Img, Data, sApplicationId);
};
CFootnotesController.prototype.AddTextArt = function(nStyle)
{
	if (false === this.private_CheckFootnotesSelectionBeforeAction())
		return false;

	return this.CurFootnote.Add_TextArt(nStyle);
};
CFootnotesController.prototype.EditChart = function(Chart)
{
	if (false === this.private_CheckFootnotesSelectionBeforeAction())
		return;

	this.CurFootnote.Edit_Chart(Chart);
};
CFootnotesController.prototype.AddInlineTable = function(Cols, Rows)
{
	if (false === this.private_CheckFootnotesSelectionBeforeAction())
		return;

	if (null !== this.CurFootnote)
		this.CurFootnote.Add_InlineTable(Cols, Rows);
};
CFootnotesController.prototype.ClearParagraphFormatting = function()
{
	for (var sId in this.Selection.Footnotes)
	{
		var oFootnote = this.Selection.Footnotes[sId];
		oFootnote.Paragraph_ClearFormatting();
	}
};
CFootnotesController.prototype.AddToParagraph = function(oItem, bRecalculate)
{
	if (oItem instanceof ParaTextPr)
	{
		for (var sId in this.Selection.Footnotes)
		{
			var oFootnote = this.Selection.Footnotes[sId];
			oFootnote.Paragraph_Add(oItem, false);
		}

		if (false !== bRecalculate)
		{
			this.LogicDocument.Recalculate();
		}
	}
	else
	{
		if (false === this.private_CheckFootnotesSelectionBeforeAction())
			return;

		if (null !== this.CurFootnote)
			this.CurFootnote.Paragraph_Add(oItem, bRecalculate);
	}
};
CFootnotesController.prototype.Remove = function(Count, bOnlyText, bRemoveOnlySelection, bOnTextAdd)
{
	if (false === this.private_CheckFootnotesSelectionBeforeAction())
		return;

	this.CurFootnote.Remove(Count, bOnlyText, bRemoveOnlySelection, bOnTextAdd);
};
CFootnotesController.prototype.GetCursorPosXY = function()
{
	// Если есть селект, тогда конец селекта совпадает с CurFootnote
	if (null !== this.CurFootnote)
		return this.CurFootnote.Cursor_GetPos();

	return {X : 0, Y : 0}
};
CFootnotesController.prototype.MoveCursorToStartPos = function(AddToSelect)
{
	if (true !== AddToSelect)
	{
		this.LogicDocument.controller_MoveCursorToStartPos(false);
	}
	else
	{
		var oFootnote = this.CurFootnote;
		if (true === this.Selection.Use)
			oFootnote = this.Selection.Start.Footnote;

		var arrRange = this.LogicDocument.Get_FootnotesList(null, oFootnote);
		if (arrRange.length <= 0)
			return;

		if (true !== this.Selection.Use)
			this.LogicDocument.Start_SelectionFromCurPos();

		this.Selection.End.Footnote   = arrRange[0];
		this.Selection.Start.Footnote = oFootnote;
		this.Selection.Footnotes      = {};

		oFootnote.Cursor_MoveToStartPos(true);
		this.Selection.Footnotes = {};
		this.Selection.Footnotes[oFootnote.Get_Id()]  = oFootnote;
		for (var nIndex = 0, nCount = arrRange.length; nIndex < nCount; ++nIndex)
		{
			var oTempFootnote = arrRange[nIndex];
			if (oTempFootnote !== oFootnote)
			{
				oTempFootnote.Select_All(-1);
				this.Selection.Footnotes[oTempFootnote.Get_Id()] = oTempFootnote;
			}
		}

		if (this.Selection.Start.Footnote !== this.Selection.End.Footnote)
			this.Selection.Direction = -1;
		else
			this.Selection.Direction = 0;
	}
};
CFootnotesController.prototype.MoveCursorToEndPos = function(AddToSelect)
{
	if (true !== AddToSelect)
	{
		this.LogicDocument.controller_MoveCursorToEndPos(false);
	}
	else
	{
		var oFootnote = this.CurFootnote;
		if (true === this.Selection.Use)
			oFootnote = this.Selection.Start.Footnote;

		var arrRange = this.LogicDocument.Get_FootnotesList(oFootnote, null);
		if (arrRange.length <= 0)
			return;

		if (true !== this.Selection.Use)
			this.LogicDocument.Start_SelectionFromCurPos();

		this.Selection.End.Footnote   = arrRange[arrRange.length - 1];
		this.Selection.Start.Footnote = oFootnote;
		this.Selection.Footnotes      = {};

		oFootnote.Cursor_MoveToEndPos(true);
		this.Selection.Footnotes = {};
		this.Selection.Footnotes[oFootnote.Get_Id()]  = oFootnote;
		for (var nIndex = 0, nCount = arrRange.length; nIndex < nCount; ++nIndex)
		{
			var oTempFootnote = arrRange[nIndex];
			if (oTempFootnote !== oFootnote)
			{
				oTempFootnote.Select_All(1);
				this.Selection.Footnotes[oTempFootnote.Get_Id()] = oTempFootnote;
			}
		}

		if (this.Selection.Start.Footnote !== this.Selection.End.Footnote)
			this.Selection.Direction = 1;
		else
			this.Selection.Direction = 0;
	}
};
CFootnotesController.prototype.MoveCursorLeft = function(AddToSelect, Word)
{
	if (true === this.Selection.Use)
	{
		if (true !== AddToSelect)
		{
			var oFootnote = this.CurFootnote;
			if (0 === this.Selection.Direction)
				oFootnote = this.CurFootnote;
			else if (1 === this.Selection.Direction)
				oFootnote = this.Selection.Start.Footnote;
			else
				oFootnote = this.Selection.End.Footnote;

			for (var sId in this.Selection.Footnotes)
			{
				if (oFootnote !== this.Selection.Footnotes[sId])
					this.Selection.Footnotes[sId].Selection_Remove();
			}

			oFootnote.Cursor_MoveLeft(false, Word);
			oFootnote.Selection_Remove();
			this.private_SetCurrentFootnoteNoSelection(oFootnote);
		}
		else
		{
			var oFootnote = this.Selection.End.Footnote;
			if (false === oFootnote.Cursor_MoveLeft(true, Word))
			{
				var oPrevFootnote = this.private_GetPrevFootnote(oFootnote);
				if (null === oPrevFootnote)
					return false;

				if (1 !== this.Selection.Direction)
				{
					this.Selection.End.Footnote = oPrevFootnote;
					this.Selection.Direction    = -1;
					this.CurFootnote            = oPrevFootnote;

					this.Selection.Footnotes[oPrevFootnote.Get_Id()] = oPrevFootnote;

					oPrevFootnote.Cursor_MoveToEndPos(false, true);
					oPrevFootnote.Cursor_MoveLeft(true, Word);
				}
				else
				{
					this.Selection.End.Footnote = oPrevFootnote;
					this.CurFootnote            = oPrevFootnote;

					if (oPrevFootnote === this.Selection.Start.Footnote)
						this.Selection.Direction = 0;

					oFootnote.Selection_Remove();
					delete this.Selection.Footnotes[oFootnote.Get_Id()];

					oPrevFootnote.Cursor_MoveLeft(true, Word);
				}
			}
		}
	}
	else
	{
		if (true === AddToSelect)
		{
			var oFootnote = this.CurFootnote;

			this.Selection.Use            = true;
			this.Selection.Start.Footnote = oFootnote;
			this.Selection.End.Footnote   = oFootnote;
			this.Selection.Footnotes      = {};
			this.Selection.Direction      = 0;

			this.Selection.Footnotes[oFootnote.Get_Id()] = oFootnote;
			if (false === oFootnote.Cursor_MoveLeft(true, Word))
			{
				var oPrevFootnote = this.private_GetPrevFootnote(oFootnote);
				if (null === oPrevFootnote)
					return false;

				this.Selection.End.Footnote = oPrevFootnote;
				this.Selection.Direction    = -1;
				this.CurFootnote            = oPrevFootnote;

				this.Selection.Footnotes[oPrevFootnote.Get_Id()] = oPrevFootnote;

				oPrevFootnote.Cursor_MoveToEndPos(false, true);
				oPrevFootnote.Cursor_MoveLeft(true, Word);
			}
		}
		else
		{
			var oFootnote = this.CurFootnote;
			if (false === oFootnote.Cursor_MoveLeft(false, Word))
			{
				var oPrevFootnote = this.private_GetPrevFootnote(oFootnote);
				if (null === oPrevFootnote)
					return false;

				this.Selection.Start.Footnote = oPrevFootnote;
				this.Selection.End.Footnote   = oPrevFootnote;
				this.Selection.Direction      = 0;
				this.CurFootnote              = oPrevFootnote;
				this.Selection.Footnotes      = {};

				this.Selection.Footnotes[oPrevFootnote.Get_Id()] = oPrevFootnote;

				oPrevFootnote.Cursor_MoveToEndPos(false);
			}
		}
	}

	return true;
};
CFootnotesController.prototype.MoveCursorRight = function(AddToSelect, Word, FromPaste)
{
	if (true === this.Selection.Use)
	{
		if (true !== AddToSelect)
		{
			var oFootnote = this.CurFootnote;
			if (0 === this.Selection.Direction)
				oFootnote = this.CurFootnote;
			else if (1 === this.Selection.Direction)
				oFootnote = this.Selection.End.Footnote;
			else
				oFootnote = this.Selection.Start.Footnote;

			for (var sId in this.Selection.Footnotes)
			{
				if (oFootnote !== this.Selection.Footnotes[sId])
					this.Selection.Footnotes[sId].Selection_Remove();
			}

			oFootnote.Cursor_MoveRight(false, Word, FromPaste);
			oFootnote.Selection_Remove();
			this.private_SetCurrentFootnoteNoSelection(oFootnote);
		}
		else
		{
			var oFootnote = this.Selection.End.Footnote;
			if (false === oFootnote.Cursor_MoveRight(true, Word, FromPaste))
			{
				var oNextFootnote = this.private_GetNextFootnote(oFootnote);
				if (null === oNextFootnote)
					return false;

				if (-1 !== this.Selection.Direction)
				{
					this.Selection.End.Footnote = oNextFootnote;
					this.Selection.Direction    = 1;
					this.CurFootnote            = oNextFootnote;

					this.Selection.Footnotes[oNextFootnote.Get_Id()] = oNextFootnote;

					oNextFootnote.Cursor_MoveToStartPos(false);
					oNextFootnote.Cursor_MoveRight(true, Word, FromPaste);
				}
				else
				{
					this.Selection.End.Footnote = oNextFootnote;
					this.CurFootnote            = oNextFootnote;

					if (oNextFootnote === this.Selection.Start.Footnote)
						this.Selection.Direction = 0;

					oFootnote.Selection_Remove();
					delete this.Selection.Footnotes[oFootnote.Get_Id()];

					oNextFootnote.Cursor_MoveRight(true, Word, FromPaste);
				}
			}
		}
	}
	else
	{
		if (true === AddToSelect)
		{
			var oFootnote = this.CurFootnote;

			this.Selection.Use            = true;
			this.Selection.Start.Footnote = oFootnote;
			this.Selection.End.Footnote   = oFootnote;
			this.Selection.Footnotes      = {};
			this.Selection.Direction      = 0;

			this.Selection.Footnotes[oFootnote.Get_Id()] = oFootnote;
			if (false === oFootnote.Cursor_MoveRight(true, Word, FromPaste))
			{
				var oNextFootnote = this.private_GetNextFootnote(oFootnote);
				if (null === oNextFootnote)
					return false;

				this.Selection.End.Footnote = oNextFootnote;
				this.Selection.Direction    = 1;
				this.CurFootnote            = oNextFootnote;

				this.Selection.Footnotes[oNextFootnote.Get_Id()] = oNextFootnote;

				oNextFootnote.Cursor_MoveToStartPos(false);
				oNextFootnote.Cursor_MoveRight(true, Word, FromPaste);
			}
		}
		else
		{
			var oFootnote = this.CurFootnote;
			if (false === oFootnote.Cursor_MoveRight(false, Word ,FromPaste))
			{
				var oNextFootnote = this.private_GetNextFootnote(oFootnote);
				if (null === oNextFootnote)
					return false;

				this.Selection.Start.Footnote = oNextFootnote;
				this.Selection.End.Footnote   = oNextFootnote;
				this.Selection.Direction      = 0;
				this.CurFootnote              = oNextFootnote;
				this.Selection.Footnotes      = {};

				this.Selection.Footnotes[oNextFootnote.Get_Id()] = oNextFootnote;

				oNextFootnote.Cursor_MoveToStartPos(false);
			}
		}
	}

	return true;
};
CFootnotesController.prototype.MoveCursorUp = function(AddToSelect)
{
	if (true === this.Selection.Use)
	{
		if (true === AddToSelect)
		{
			var oFootnote = this.Selection.End.Footnote;
			var oPos = oFootnote.Cursor_GetPos();

			if (false === oFootnote.Cursor_MoveUp(true))
			{
				var oPrevFootnote = this.private_GetPrevFootnote(oFootnote);
				if (null === oPrevFootnote)
					return false;

				oFootnote.Cursor_MoveToStartPos(true);

				if (1 !== this.Selection.Direction)
				{
					this.Selection.End.Footnote = oPrevFootnote;
					this.Selection.Direction    = -1;
					this.CurFootnote            = oPrevFootnote;

					this.Selection.Footnotes[oPrevFootnote.Get_Id()] = oPrevFootnote;

					oPrevFootnote.Cursor_MoveUp_To_LastRow(oPos.X, oPos.Y, true);
				}
				else
				{
					this.Selection.End.Footnote = oPrevFootnote;
					this.CurFootnote            = oPrevFootnote;

					if (oPrevFootnote === this.Selection.Start.Footnote)
						this.Selection.Direction = 0;

					oFootnote.Selection_Remove();
					delete this.Selection.Footnotes[oFootnote.Get_Id()];

					oPrevFootnote.Cursor_MoveUp_To_LastRow(oPos.X, oPos.Y, true);
				}

			}
		}
		else
		{
			var oFootnote = this.CurFootnote;
			if (0 === this.Selection.Direction)
				oFootnote = this.CurFootnote;
			else if (1 === this.Selection.Direction)
				oFootnote = this.Selection.Start.Footnote;
			else
				oFootnote = this.Selection.End.Footnote;

			for (var sId in this.Selection.Footnotes)
			{
				if (oFootnote !== this.Selection.Footnotes[sId])
					this.Selection.Footnotes[sId].Selection_Remove();
			}

			oFootnote.Cursor_MoveLeft(false, false);
			oFootnote.Selection_Remove();
			this.private_SetCurrentFootnoteNoSelection(oFootnote);
		}
	}
	else
	{
		if (true === AddToSelect)
		{
			var oFootnote = this.CurFootnote;
			var oPos = oFootnote.Cursor_GetPos();
			
			this.Selection.Use            = true;
			this.Selection.Start.Footnote = oFootnote;
			this.Selection.End.Footnote   = oFootnote;
			this.Selection.Footnotes      = {};
			this.Selection.Direction      = 0;

			this.Selection.Footnotes[oFootnote.Get_Id()] = oFootnote;
			if (false === oFootnote.Cursor_MoveUp(true))
			{
				var oPrevFootnote = this.private_GetPrevFootnote(oFootnote);
				if (null === oPrevFootnote)
					return false;

				oFootnote.Cursor_MoveToStartPos(true);

				this.Selection.End.Footnote = oPrevFootnote;
				this.Selection.Direction    = -1;
				this.CurFootnote            = oPrevFootnote;

				this.Selection.Footnotes[oPrevFootnote.Get_Id()] = oPrevFootnote;

				oPrevFootnote.Cursor_MoveUp_To_LastRow(oPos.X, oPos.Y, true);
			}
		}
		else
		{
			var oFootnote = this.CurFootnote;
			var oPos = oFootnote.Cursor_GetPos();
			if (false === oFootnote.Cursor_MoveUp(false))
			{
				var oPrevFootnote = this.private_GetPrevFootnote(oFootnote);
				if (null === oPrevFootnote)
					return false;

				this.Selection.Start.Footnote = oPrevFootnote;
				this.Selection.End.Footnote   = oPrevFootnote;
				this.Selection.Direction      = 0;
				this.CurFootnote              = oPrevFootnote;
				this.Selection.Footnotes      = {};

				this.Selection.Footnotes[oPrevFootnote.Get_Id()] = oPrevFootnote;

				oPrevFootnote.Cursor_MoveUp_To_LastRow(oPos.X, oPos.Y, false);
			}
		}
	}

	return true;
};
CFootnotesController.prototype.MoveCursorDown = function(AddToSelect)
{
	if (true === this.Selection.Use)
	{
		if (true === AddToSelect)
		{
			var oFootnote = this.Selection.End.Footnote;
			var oPos = oFootnote.Cursor_GetPos();

			if (false === oFootnote.Cursor_MoveDown(true))
			{
				var oNextFootnote = this.private_GetNextFootnote(oFootnote);
				if (null === oNextFootnote)
					return false;

				oFootnote.Cursor_MoveToEndPos(true);

				if (-1 !== this.Selection.Direction)
				{
					this.Selection.End.Footnote = oNextFootnote;
					this.Selection.Direction    = 1;
					this.CurFootnote            = oNextFootnote;

					this.Selection.Footnotes[oNextFootnote.Get_Id()] = oNextFootnote;

					oNextFootnote.Cursor_MoveDown_To_FirstRow(oPos.X, oPos.Y, true);
				}
				else
				{
					this.Selection.End.Footnote = oNextFootnote;
					this.CurFootnote            = oNextFootnote;

					if (oNextFootnote === this.Selection.Start.Footnote)
						this.Selection.Direction = 0;

					oFootnote.Selection_Remove();
					delete this.Selection.Footnotes[oFootnote.Get_Id()];

					oNextFootnote.Cursor_MoveDown_To_FirstRow(oPos.X, oPos.Y, true);
				}

			}
		}
		else
		{
			var oFootnote = this.CurFootnote;
			if (0 === this.Selection.Direction)
				oFootnote = this.CurFootnote;
			else if (1 === this.Selection.Direction)
				oFootnote = this.Selection.End.Footnote;
			else
				oFootnote = this.Selection.Start.Footnote;

			for (var sId in this.Selection.Footnotes)
			{
				if (oFootnote !== this.Selection.Footnotes[sId])
					this.Selection.Footnotes[sId].Selection_Remove();
			}

			oFootnote.Cursor_MoveRight(false, false);
			oFootnote.Selection_Remove();
			this.private_SetCurrentFootnoteNoSelection(oFootnote);
		}
	}
	else
	{
		if (true === AddToSelect)
		{
			var oFootnote = this.CurFootnote;
			var oPos = oFootnote.Cursor_GetPos();

			this.Selection.Use            = true;
			this.Selection.Start.Footnote = oFootnote;
			this.Selection.End.Footnote   = oFootnote;
			this.Selection.Footnotes      = {};
			this.Selection.Direction      = 0;

			this.Selection.Footnotes[oFootnote.Get_Id()] = oFootnote;
			if (false === oFootnote.Cursor_MoveDown(true))
			{
				var oNextFootnote = this.private_GetNextFootnote(oFootnote);
				if (null === oNextFootnote)
					return false;

				oFootnote.Cursor_MoveToEndPos(true, false);

				this.Selection.End.Footnote = oNextFootnote;
				this.Selection.Direction    = 1;
				this.CurFootnote            = oNextFootnote;

				this.Selection.Footnotes[oNextFootnote.Get_Id()] = oNextFootnote;

				oNextFootnote.Cursor_MoveDown_To_FirstRow(oPos.X, oPos.Y, true);
			}
		}
		else
		{
			var oFootnote = this.CurFootnote;
			var oPos = oFootnote.Cursor_GetPos();
			if (false === oFootnote.Cursor_MoveDown(false))
			{
				var oNextFootnote = this.private_GetNextFootnote(oFootnote);
				if (null === oNextFootnote)
					return false;

				this.Selection.Start.Footnote = oNextFootnote;
				this.Selection.End.Footnote   = oNextFootnote;
				this.Selection.Direction      = 0;
				this.CurFootnote              = oNextFootnote;
				this.Selection.Footnotes      = {};

				this.Selection.Footnotes[oNextFootnote.Get_Id()] = oNextFootnote;

				oNextFootnote.Cursor_MoveDown_To_FirstRow(oPos.X, oPos.Y, false);
			}
		}
	}

	return true;
};
CFootnotesController.prototype.MoveCursorToEndOfLine = function(AddToSelect)
{
	if (true === this.Selection.Use)
	{
		if (true === AddToSelect)
		{
			var oFootnote = this.Selection.End.Footnote;
			oFootnote.Cursor_MoveEndOfLine(true);
		}
		else
		{
			var oFootonote = null;
			if (0 === this.Selection.Direction)
				oFootnote = this.CurFootnote;
			else if (1 === this.Selection.Direction)
				oFootnote = this.Selection.End.Footnote;
			else
				oFootnote = this.Selection.Start.Footnote;

			for (var sId in this.Selection.Footnotes)
			{
				if (oFootnote !== this.Selection.Footnotes[sId])
					this.Selection.Footnotes[sId].Selection_Remove();
			}

			oFootnote.Cursor_MoveEndOfLine(false);
			oFootnote.Selection_Remove();
			this.private_SetCurrentFootnoteNoSelection(oFootnote);
		}
	}
	else
	{
		if (true === AddToSelect)
		{
			var oFootnote = this.CurFootnote;

			this.Selection.Use            = true;
			this.Selection.Start.Footnote = oFootnote;
			this.Selection.End.Footnote   = oFootnote;
			this.Selection.Footnotes      = {};
			this.Selection.Direction      = 0;

			this.Selection.Footnotes[oFootnote.Get_Id()] = oFootnote;
			oFootnote.Cursor_MoveEndOfLine(true);
		}
		else
		{
			this.CurFootnote.Cursor_MoveEndOfLine(false);
		}
	}

	return true;
};
CFootnotesController.prototype.MoveCursorToStartOfLine = function(AddToSelect)
{
	if (true === this.Selection.Use)
	{
		if (true === AddToSelect)
		{
			var oFootnote = this.Selection.End.Footnote;
			oFootnote.Cursor_MoveStartOfLine(true);
		}
		else
		{
			var oFootonote = null;
			if (0 === this.Selection.Direction)
				oFootnote = this.CurFootnote;
			else if (1 === this.Selection.Direction)
				oFootnote = this.Selection.Start.Footnote;
			else
				oFootnote = this.Selection.End.Footnote;

			for (var sId in this.Selection.Footnotes)
			{
				if (oFootnote !== this.Selection.Footnotes[sId])
					this.Selection.Footnotes[sId].Selection_Remove();
			}

			oFootnote.Cursor_MoveStartOfLine(false);
			oFootnote.Selection_Remove();
			this.private_SetCurrentFootnoteNoSelection(oFootnote);
		}
	}
	else
	{
		if (true === AddToSelect)
		{
			var oFootnote = this.CurFootnote;

			this.Selection.Use            = true;
			this.Selection.Start.Footnote = oFootnote;
			this.Selection.End.Footnote   = oFootnote;
			this.Selection.Footnotes      = {};
			this.Selection.Direction      = 0;

			this.Selection.Footnotes[oFootnote.Get_Id()] = oFootnote;
			oFootnote.Cursor_MoveStartOfLine(true);
		}
		else
		{
			this.CurFootnote.Cursor_MoveStartOfLine(false);
		}
	}

	return true;
};
CFootnotesController.prototype.MoveCursorToXY = function(X, Y, PageAbs, AddToSelect)
{
	var oResult = this.private_GetFootnoteByXY(X, Y, PageAbs);
	if (!oResult || !oResult.Footnote)
		return;

	var oFootnote = oResult.Footnote;
	var PageRel   = oFootnote.GetRelaitivePageIndex(PageAbs);
	if (true === AddToSelect)
	{
		var StartFootnote = null;
		if (true === this.Selection.Use)
		{
			StartFootnote = this.Selection.Start.Footnote;
			for (var sId in this.Selection.Footnotes)
			{
				if (this.Selection.Footnotes[sId] !== StartFootnote)
				{
					this.Selection.Footnotes[sId].Selection_Remove();
				}
			}
		}
		else
		{
			StartFootnote = this.CurFootnote;
		}

		var nDirection = this.private_GetDirection(StartFootnote, oFootnote);
		if (0 === nDirection)
		{
			this.Selection.Use            = true;
			this.Selection.Start.Footnote = oFootnote;
			this.Selection.End.Footnote   = oFootnote;
			this.Selection.Footnotes      = {};
			this.Selection.Direction      = 0;

			this.Selection.Footnotes[oFootnote.Get_Id()] = oFootnote;
			oFootnote.Cursor_MoveAt(X, Y, true, true, PageRel);
		}
		else if (nDirection > 0)
		{
			var arrFootnotes = this.private_GetFootnotesLogicRange(StartFootnote, oFootnote);
			if (arrFootnotes.length <= 1)
				return;

			var oStartFootnote = arrFootnotes[0]; // StartFootnote
			var oEndFootnote   = arrFootnotes[arrFootnotes.length - 1]; // oFootnote

			this.Selection.Use            = true;
			this.Selection.Start.Footnote = oStartFootnote;
			this.Selection.End.Footnote   = oEndFootnote;
			this.CurFootnote              = oEndFootnote;
			this.Selection.Footnotes      = {};
			this.Selection.Direction      = 1;

			oStartFootnote.Cursor_MoveToEndPos(true, false);

			for (var nPos = 0, nCount = arrFootnotes.length; nPos < nCount; ++nPos)
			{
				this.Selection.Footnotes[arrFootnotes[nPos].Get_Id()] = arrFootnotes[nPos];

				if (0 !== nPos && nPos !== nCount - 1)
					arrFootnotes[nPos].Select_All(1);
			}

			oEndFootnote.Cursor_MoveToStartPos(false);
			oEndFootnote.Cursor_MoveAt(X, Y, true, true, PageRel);
		}
		else if (nDirection < 0)
		{
			var arrFootnotes = this.private_GetFootnotesLogicRange(oFootnote, StartFootnote);
			if (arrFootnotes.length <= 1)
				return;

			var oEndFootnote   = arrFootnotes[0]; // oFootnote
			var oStartFootnote = arrFootnotes[arrFootnotes.length - 1]; // StartFootnote

			this.Selection.Use            = true;
			this.Selection.Start.Footnote = oStartFootnote;
			this.Selection.End.Footnote   = oEndFootnote;
			this.CurFootnote              = oEndFootnote;
			this.Selection.Footnotes      = {};
			this.Selection.Direction      = -1;

			oStartFootnote.Cursor_MoveToStartPos(true);

			for (var nPos = 0, nCount = arrFootnotes.length; nPos < nCount; ++nPos)
			{
				this.Selection.Footnotes[arrFootnotes[nPos].Get_Id()] = arrFootnotes[nPos];

				if (0 !== nPos && nPos !== nCount - 1)
					arrFootnotes[nPos].Select_All(-1);
			}

			oEndFootnote.Cursor_MoveToEndPos(false, true);
			oEndFootnote.Cursor_MoveAt(X, Y, true, true, PageRel);
		}
	}
	else
	{
		if (true === this.Selection.Use)
		{
			this.RemoveSelection();
		}

		this.private_SetCurrentFootnoteNoSelection(oFootnote);
		oFootnote.Cursor_MoveAt(X, Y, false, true, PageRel);
	}
};
CFootnotesController.prototype.MoveCursorToCell = function(bNext)
{
	if (true !== this.private_IsOnFootnoteSelected() || null === this.CurFootnote)
		return false;

	return this.CurFootnote.Cursor_MoveToCell(bNext);
};
CFootnotesController.prototype.SetParagraphAlign = function(Align)
{
	for (var sId in this.Selection.Footnotes)
	{
		var oFootnote = this.Selection.Footnotes[sId];
		oFootnote.Set_ParagraphAlign(Align);
	}
};
CFootnotesController.prototype.SetParagraphSpacing = function(Spacing)
{
	for (var sId in this.Selection.Footnotes)
	{
		var oFootnote = this.Selection.Footnotes[sId];
		oFootnote.Set_ParagraphSpacing(Spacing);
	}
};
CFootnotesController.prototype.SetParagraphTabs = function(Tabs)
{
	for (var sId in this.Selection.Footnotes)
	{
		var oFootnote = this.Selection.Footnotes[sId];
		oFootnote.Set_ParagraphTabs(Tabs);
	}
};
CFootnotesController.prototype.SetParagraphIndent = function(Ind)
{
	for (var sId in this.Selection.Footnotes)
	{
		var oFootnote = this.Selection.Footnotes[sId];
		oFootnote.Set_ParagraphIndent(Ind);
	}
};
CFootnotesController.prototype.SetParagraphNumbering = function(NumInfo)
{
	for (var sId in this.Selection.Footnotes)
	{
		var oFootnote = this.Selection.Footnotes[sId];
		oFootnote.Set_ParagraphNumbering(NumInfo);
	}
};
CFootnotesController.prototype.SetParagraphShd = function(Shd)
{
	for (var sId in this.Selection.Footnotes)
	{
		var oFootnote = this.Selection.Footnotes[sId];
		oFootnote.Set_ParagraphShd(Shd);
	}
};
CFootnotesController.prototype.SetParagraphStyle = function(Name)
{
	for (var sId in this.Selection.Footnotes)
	{
		var oFootnote = this.Selection.Footnotes[sId];
		oFootnote.Set_ParagraphStyle(Name);
	}
};
CFootnotesController.prototype.SetParagraphContextualSpacing = function(Value)
{
	for (var sId in this.Selection.Footnotes)
	{
		var oFootnote = this.Selection.Footnotes[sId];
		oFootnote.Set_ParagraphContextualSpacing(Value);
	}
};
CFootnotesController.prototype.SetParagraphPageBreakBefore = function(Value)
{
	for (var sId in this.Selection.Footnotes)
	{
		var oFootnote = this.Selection.Footnotes[sId];
		oFootnote.Set_ParagraphPageBreakBefore(Value);
	}
};
CFootnotesController.prototype.SetParagraphKeepLines = function(Value)
{
	for (var sId in this.Selection.Footnotes)
	{
		var oFootnote = this.Selection.Footnotes[sId];
		oFootnote.Set_ParagraphKeepLines(Value);
	}
};
CFootnotesController.prototype.SetParagraphKeepNext = function(Value)
{
	for (var sId in this.Selection.Footnotes)
	{
		var oFootnote = this.Selection.Footnotes[sId];
		oFootnote.Set_ParagraphKeepNext(Value);
	}
};
CFootnotesController.prototype.SetParagraphWidowControl = function(Value)
{
	for (var sId in this.Selection.Footnotes)
	{
		var oFootnote = this.Selection.Footnotes[sId];
		oFootnote.Set_ParagraphWidowControl(Value);
	}
};
CFootnotesController.prototype.SetParagraphBorders = function(Borders)
{
	for (var sId in this.Selection.Footnotes)
	{
		var oFootnote = this.Selection.Footnotes[sId];
		oFootnote.Set_ParagraphBorders(Borders);
	}
};
CFootnotesController.prototype.SetParagraphFramePr = function(FramePr, bDelete)
{
	// Не позволяем делать рамки внутри сносок
};
CFootnotesController.prototype.IncreaseOrDecreaseParagraphFontSize = function(bIncrease)
{
	for (var sId in this.Selection.Footnotes)
	{
		var oFootnote = this.Selection.Footnotes[sId];
		oFootnote.Paragraph_IncDecFontSize(bIncrease);
	}
};
CFootnotesController.prototype.IncreaseOrDecreaseParagraphIndent = function(bIncrease)
{
	for (var sId in this.Selection.Footnotes)
	{
		var oFootnote = this.Selection.Footnotes[sId];
		oFootnote.Paragraph_IncDecIndent(bIncrease);
	}
};
CFootnotesController.prototype.SetImageProps = function(Props)
{
	if (false === this.private_CheckFootnotesSelectionBeforeAction())
		return;

	return this.CurFootnote.Set_ImageProps(Props);
};
CFootnotesController.prototype.SetTableProps = function(Props)
{
	if (false === this.private_CheckFootnotesSelectionBeforeAction())
		return;

	return this.CurFootnote.Set_TableProps(Props);
};
CFootnotesController.prototype.GetCurrentParaPr = function()
{
	var StartPr = this.CurFootnote.Get_Paragraph_ParaPr();
	var Pr = StartPr.Copy();

	for (var sId in this.Selection.Footnotes)
	{
		var oFootnote = this.Selection.Footnotes[sId];
		var TempPr = oFootnote.Get_Paragraph_ParaPr();
		Pr = Pr.Compare(TempPr);
	}

	if (undefined === Pr.Ind.Left)
		Pr.Ind.Left = StartPr.Ind.Left;

	if (undefined === Pr.Ind.Right)
		Pr.Ind.Right = StartPr.Ind.Right;

	if (undefined === Pr.Ind.FirstLine)
		Pr.Ind.FirstLine = StartPr.Ind.FirstLine;

	if (true !== this.private_IsOnFootnoteSelected())
		Pr.CanAddTable = false;

	return Pr;
};
CFootnotesController.prototype.GetCurrentTextPr = function()
{
	var StartPr = this.CurFootnote.Get_Paragraph_TextPr();
	var Pr = StartPr.Copy();

	for (var sId in this.Selection.Footnotes)
	{
		var oFootnote = this.Selection.Footnotes[sId];
		var TempPr = oFootnote.Get_Paragraph_TextPr();
		Pr = Pr.Compare(TempPr);
	}

	return Pr;
};
CFootnotesController.prototype.GetDirectParaPr = function()
{
	if (null !== this.CurFootnote)
		return this.CurFootnote.Get_Paragraph_ParaPr_Copy();

	return new CParaPr();
};
CFootnotesController.prototype.GetDirectTextPr = function()
{
	if (null !== this.CurFootnote)
		return this.CurFootnote.Get_Paragraph_TextPr_Copy();

	return new CTextPr();
};
CFootnotesController.prototype.RemoveSelection = function(bNoCheckDrawing)
{
	if (true === this.Selection.Use)
	{
		for (var sId in this.Selection.Footnotes)
		{
			this.Selection.Footnotes[sId].Selection_Remove(bNoCheckDrawing);
		}

		this.Selection.Use = false;
	}

	this.Selection.Footnotes = {};
	if (this.CurFootnote)
		this.Selection.Footnotes[this.CurFootnote.Get_Id()] = this.CurFootnote;
};
CFootnotesController.prototype.IsEmptySelection = function(bCheckHidden)
{
	if (true !== this.IsSelectionUse())
		return true;

	var oFootnote = null;
	for (var sId in this.Selection.Footnotes)
	{
		if (null === oFootnote)
			oFootnote = this.Selection.Footnotes[sId];
		else if (oFootnote !== this.Selection.Footnotes[sId])
			return false;
	}

	if (null === oFootnote)
		return true;

	return oFootnote.Selection_IsEmpty(bCheckHidden);
};
CFootnotesController.prototype.DrawSelectionOnPage = function(PageAbs)
{
	if (true !== this.Selection.Use || true === this.Is_EmptyPage(PageAbs))
		return;

	var Page = this.Pages[PageAbs];
	for (var nIndex = 0, nCount = Page.Elements.length; nIndex < nCount; ++nIndex)
	{
		var oFootnote = Page.Elements[nIndex];
		if (oFootnote === this.Selection.Footnotes[oFootnote.Get_Id()])
		{
			var PageRel = oFootnote.GetRelaitivePageIndex(PageAbs);
			oFootnote.Selection_Draw_Page(PageRel);
		}
	}
};
CFootnotesController.prototype.GetSelectionBounds = function()
{
	if (true === this.Selection.Use)
	{
		if (0 === this.Selection.Direction)
		{
			return this.CurFootnote.Get_SelectionBounds();
		}
		else if (1 === this.Selection.Direction)
		{
			var Result       = {};
			Result.Start     = this.Selection.Start.Footnote.Get_SelectionBounds().Start;
			Result.End       = this.Selection.End.Footnote.Get_SelectionBounds().End;
			Result.Direction = 1;
			return Result;
		}
		else
		{
			var Result       = {};
			Result.Start     = this.Selection.End.Footnote.Get_SelectionBounds().Start;
			Result.End       = this.Selection.Start.Footnote.Get_SelectionBounds().End;
			Result.Direction = -1;
			return Result;
		}
	}

	return null;
};
CFootnotesController.prototype.IsMovingTableBorder = function()
{
	if (true !== this.private_IsOnFootnoteSelected())
		return false;

	return this.CurFootnote.Selection_Is_TableBorderMove();
};
CFootnotesController.prototype.CheckPosInSelection = function(X, Y, PageAbs, NearPos)
{
	// TODO: Доделать с NearPos

	var oResult = this.private_GetFootnoteByXY(X, Y, PageAbs);
	if (oResult)
	{
		var oFootnote = oResult.Footnote;
		var PageRel = oFootnote.GetRelaitivePageIndex(PageAbs);
		return oFootnote.Selection_Check(X, Y, PageRel, NearPos);
	}

	return false;
};
CFootnotesController.prototype.SelectAll = function(nDirection)
{
	var arrFootnotes = this.private_GetFootnotesLogicRange(null, null);
	if (!arrFootnotes || arrFootnotes.length <= 0)
		return;

	if (1 === arrFootnotes.length)
	{
		var oFootnote = arrFootnotes[0];

		this.Selection.Use            = true;
		this.Selection.Start.Footnote = oFootnote;
		this.Selection.End.Footnote   = oFootnote;
		this.CurFootnote              = oFootnote;
		this.Selection.Footnotes      = {};
		this.Selection.Direction      = 0;

		this.Selection.Footnotes[oFootnote.Get_Id()] = oFootnote;
		oFootnote.Select_All(nDirection);
	}
	else
	{
		var StartFootnote, EndFootnote;
		if (nDirection < 0)
		{
			StartFootnote = arrFootnotes[arrFootnotes.length - 1];
			EndFootnote   = arrFootnotes[0];
			this.Selection.Direction = -1;
		}
		else
		{
			StartFootnote = arrFootnotes[0];
			EndFootnote   = arrFootnotes[arrFootnotes.length - 1];
			this.Selection.Direction = -1;
		}

		this.Selection.Use            = true;
		this.Selection.Start.Footnote = StartFootnote;
		this.Selection.End.Footnote   = EndFootnote;
		this.CurFootnote              = EndFootnote;
		this.Selection.Footnotes      = {};

		for (var nPos = 0, nCount = arrFootnotes.length; nPos < nCount; ++nPos)
		{
			var oFootnote = arrFootnotes[nPos];
			oFootnote.Select_All(nDirection);
			this.Selection.Footnotes[oFootnote.Get_Id()] = oFootnote;
		}
	}
};
CFootnotesController.prototype.GetSelectedContent = function(SelectedContent)
{
	if (true !== this.Selection.Use)
		return;

	if (0 === this.Selection.Direction)
	{
		this.CurFootnote.Get_SelectedContent(SelectedContent);
	}
	else
	{
		var arrFootnotes = this.private_GetSelectionArray();
		for (var nPos = 0, nCount = arrFootnotes.length; nPos < nCount; ++nPos)
		{
			arrFootnotes[nPos].Get_SelectedContent(SelectedContent);
		}
	}
};
CFootnotesController.prototype.UpdateCursorType = function(X, Y, PageAbs, MouseEvent)
{
	var oResult = this.private_GetFootnoteByXY(X, Y, PageAbs);
	if (oResult)
	{
		var oFootnote = oResult.Footnote;
		var PageRel = oFootnote.GetRelaitivePageIndex(PageAbs);
		oFootnote.Update_CursorType(X, Y, PageRel, MouseEvent);
	}
};
CFootnotesController.prototype.PasteFormatting = function(TextPr, ParaPr)
{
	for (var sId in this.Selection.Footnotes)
	{
		this.Selection.Footnotes[sId].Paragraph_Format_Paste(TextPr, ParaPr, true);
	}
};
CFootnotesController.prototype.IsSelectionUse = function()
{
	return this.Selection.Use;
};
CFootnotesController.prototype.IsTextSelectionUse = function()
{
	if (true !== this.Selection.Use)
		return false;

	if (0 === this.Selection.Direction)
		return this.CurFootnote.Is_TextSelectionUse();

	return true;
};
CFootnotesController.prototype.GetCurPosXY = function()
{
	if (this.CurFootnote)
		return this.CurFootnote.Get_CurPosXY();

	return {X : 0, Y : 0};
};
CFootnotesController.prototype.GetSelectedText = function(bClearText)
{
	if (true === bClearText)
	{
		if (true !== this.Selection.Use || 0 !== this.Selection.Direction)
			return null;

		return this.CurFootnote.Get_SelectedText(true);
	}
	else
	{
		var sResult = "";
		var arrFootnotes = this.private_GetSelectionArray();
		for (var nPos = 0, nCount = arrFootnotes.length; nPos < nCount; ++nPos)
		{
			var sTempResult = arrFootnotes[nPos].Get_SelectedText(false);
			if (null == sTempResult)
				return null;

			sResult += sTempResult;
		}

		return sResult;
	}
};
CFootnotesController.prototype.GetCurrentParagraph = function()
{
	return this.CurFootnote.Get_CurrentParagraph();
};
CFootnotesController.prototype.GetSelectedElementsInfo = function(oInfo)
{
	if (true !== this.private_IsOnFootnoteSelected() || null === this.CurFootnote)
		oInfo.Set_MixedSelection();
	else
		this.CurFootnote.Get_SelectedElementsInfo(oInfo);
};
CFootnotesController.prototype.AddTableRow = function(bBefore)
{
	if (false === this.private_CheckFootnotesSelectionBeforeAction())
		return;

	this.CurFootnote.Table_AddRow(bBefore);
};
CFootnotesController.prototype.AddTableCol = function(bBefore)
{
	if (false === this.private_CheckFootnotesSelectionBeforeAction())
		return;

	this.CurFootnote.Table_AddCol(bBefore);
};
CFootnotesController.prototype.RemoveTableRow = function()
{
	if (false === this.private_CheckFootnotesSelectionBeforeAction())
		return;

	this.CurFootnote.Table_RemoveRow();
};
CFootnotesController.prototype.RemoveTableCol = function()
{
	if (false === this.private_CheckFootnotesSelectionBeforeAction())
		return;

	this.CurFootnote.Table_RemoveCol();
};
CFootnotesController.prototype.MergeTableCells = function()
{
	if (false === this.private_CheckFootnotesSelectionBeforeAction())
		return;

	this.CurFootnote.Table_MergeCells();
};
CFootnotesController.prototype.SplitTableCells = function(Cols, Rows)
{
	if (false === this.private_CheckFootnotesSelectionBeforeAction())
		return;

	this.CurFootnote.Table_SplitCell(Cols, Rows);
};
CFootnotesController.prototype.RemoveTable = function()
{
	if (false === this.private_CheckFootnotesSelectionBeforeAction())
		return;

	this.CurFootnote.Table_RemoveTable();
};
CFootnotesController.prototype.SelectTable = function(Type)
{
	if (false === this.private_CheckFootnotesSelectionBeforeAction())
		return;

	this.RemoveSelection();

	this.CurFootnote.Table_Select(Type);
	if (true === this.CurFootnote.Is_SelectionUse())
	{
		this.Selection.Use            = true;
		this.Selection.Start.Footnote = this.CurFootnote;
		this.Selection.End.Footnote   = this.CurFootnote;
		this.Selection.Footnotes      = {};
		this.Selection.Direction      = 0;

		this.Selection.Footnotes[this.CurFootnote.Get_Id()] = this.CurFootnote;
	}
};
CFootnotesController.prototype.CanMergeTableCells = function()
{
	if (false === this.private_CheckFootnotesSelectionBeforeAction())
		return false;

	return this.CurFootnote.Table_CheckMerge();
};
CFootnotesController.prototype.CanSplitTableCells = function()
{
	if (false === this.private_CheckFootnotesSelectionBeforeAction())
		return false;

	return this.CurFootnote.Table_CheckSplit();
};
CFootnotesController.prototype.UpdateInterfaceState = function()
{
	if (true === this.private_IsOnFootnoteSelected())
	{
		this.CurFootnote.Document_UpdateInterfaceState();
	}
	else
	{
		var Api = this.LogicDocument.Get_Api();
		if (!Api)
			return;

		var ParaPr = this.GetCurrentParaPr();

		if (undefined != ParaPr.Tabs)
			Api.Update_ParaTab(AscCommonWord.Default_Tab_Stop, ParaPr.Tabs);

		Api.UpdateParagraphProp(ParaPr);
		Api.UpdateTextPr(this.GetCurrentTextPr());
	}
};
CFootnotesController.prototype.UpdateRulersState = function()
{
	var PageAbs = this.CurFootnote.Get_StartPage_Absolute();
	if (this.LogicDocument.Pages[PageAbs])
	{
		var Pos    = this.LogicDocument.Pages[PageAbs].Pos;
		var SectPr = this.LogicDocument.SectionsInfo.Get_SectPr(Pos).SectPr;

		var L = SectPr.Get_PageMargin_Left();
		var T = SectPr.Get_PageMargin_Top();
		var R = SectPr.Get_PageWidth() - SectPr.Get_PageMargin_Right();
		var B = SectPr.Get_PageHeight() - SectPr.Get_PageMargin_Bottom();
		this.DrawingDocument.Set_RulerState_Paragraph({L : L, T : T, R : R, B : B}, true);
	}

	if (true === this.private_IsOnFootnoteSelected())
		this.CurFootnote.Document_UpdateRulersState();
};
CFootnotesController.prototype.UpdateSelectionState = function()
{
	// TODO: Надо подумать как это вынести в верхнюю функцию
	if (true === this.Selection.Use)
	{
		// TODO: Обработать движения границ таблицы
		if (false === this.IsEmptySelection())
		{
			if (true !== this.LogicDocument.Selection.Start)
			{
				this.LogicDocument.Internal_CheckCurPage();
				this.RecalculateCurPos();
			}

			this.LogicDocument.private_UpdateTracks(true, false);

			this.DrawingDocument.TargetEnd();
			this.DrawingDocument.SelectEnabled(true);
			this.DrawingDocument.SelectShow();
		}
		else
		{
			if (true !== this.LogicDocument.Selection.Start)
				this.LogicDocument.Selection_Remove();

			this.LogicDocument.Internal_CheckCurPage();
			this.RecalculateCurPos();
			this.LogicDocument.private_UpdateTracks(true, true);

			this.DrawingDocument.SelectEnabled(false);
			this.DrawingDocument.TargetStart();
			this.DrawingDocument.TargetShow();
		}
	}
	else
	{
		this.LogicDocument.Selection_Remove();
		this.LogicDocument.Internal_CheckCurPage();
		this.RecalculateCurPos();
		this.LogicDocument.private_UpdateTracks(false, false);

		this.DrawingDocument.SelectEnabled(false);
		this.DrawingDocument.TargetShow();
	}
};
CFootnotesController.prototype.GetSelectionState = function()
{
	// TODO: Реализовать
	return [];
};
CFootnotesController.prototype.SetSelectionState = function(State, StateIndex)
{
	// TODO: Реализовать
};
CFootnotesController.prototype.AddHyperlink = function(Props)
{
	// TODO: Реализовать
};
CFootnotesController.prototype.ModifyHyperlink = function(Props)
{
	// TODO: Реализовать
};
CFootnotesController.prototype.RemoveHyperlink = function()
{
	// TODO: Реализовать
};
CFootnotesController.prototype.CanAddHyperlink = function(bCheckInHyperlink)
{
	// TODO: Реализовать
	return false;
};
CFootnotesController.prototype.IsCursorInHyperlink = function(bCheckEnd)
{
	// TODO: Реализовать
	return null;
};
CFootnotesController.prototype.AddComment = function(Comment)
{
	// TODO: Реализовать
};
CFootnotesController.prototype.CanAddComment = function()
{
	// TODO: Реализовать
};
CFootnotesController.prototype.GetSelectionAnchorPos = function()
{
	// TODO: Реализовать
	return {
		X0   : 0,
		Y    : 0,
		X1   : 0,
		Page : 0
	};
};
CFootnotesController.prototype.StartSelectionFromCurPos = function()
{
	if (true === this.Selection.Use)
		return;

	this.Selection.Use = true;
	this.Selection.Start.Footnote = this.CurFootnote;
	this.Selection.End.Footnote   = this.CurFootnote;
	this.Selection.Footnotes = {};
	this.Selection.Footnotes[this.CurFootnote.Get_Id()] = this.CurFootnote;
	this.CurFootnote.Start_SelectionFromCurPos();
};
CFootnotesController.prototype.SaveDocumentStateBeforeLoadChanges = function(State)
{
	// TODO: Реализовать
};
CFootnotesController.prototype.RestoreDocumentStateAfterLoadChanges = function(State)
{
	// TODO: Реализовать
};



function CFootEndnotePage()
{
	this.X      = 0;
	this.Y      = 0;
	this.XLimit = 0;
	this.YLimit = 0;

	this.Elements = [];

	this.SeparatorRecalculateObject             = null;
	this.ContinuationSeparatorRecalculateObject = null;
	this.ContinuationNoticeRecalculateObject    = null;
}
CFootEndnotePage.prototype.Reset = function()
{
	this.X      = 0;
	this.Y      = 0;
	this.XLimit = 0;
	this.YLimit = 0;

	this.Elements = [];

	this.SeparatorRecalculateObject             = null;
	this.ContinuationSeparatorRecalculateObject = null;
	this.ContinuationNoticeRecalculateObject    = null;
};