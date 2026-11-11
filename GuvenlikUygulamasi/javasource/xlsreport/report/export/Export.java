package xlsreport.report.export;

import java.util.List;

import system.proxies.FileDocument;
import xlsreport.proxies.MxSheet;
import xlsreport.proxies.MxTemplate;
import xlsreport.report.data.ColumnPreset;

import com.mendix.core.Core;
import com.mendix.logging.ILogNode;
import com.mendix.systemwideinterfaces.core.IContext;
import com.mendix.systemwideinterfaces.core.IMendixObject;

public abstract class Export implements AutoCloseable
{
	protected static ILogNode log = Core.getLogger("XLSreport");
	protected IContext context;
	protected IMendixObject inputObject;

    public Export(IContext context, IMendixObject inputObject)
	{
		this.context = context;
		this.inputObject = inputObject;
	}

	abstract public void buildExportFile(MxSheet mxSheet, List<ColumnPreset> mxColumnList, Object[][] Table,MxTemplate template) throws Exception;
	
	abstract public void writeData(FileDocument outputDocument) throws Exception;
	
	public static String getDatePresentation(MxTemplate template)
	{
		String datePresentation = "M/d/yy H:mm";

		if(template.getDateTimePresentation() != null)
    	{
	    	switch(template.getDateTimePresentation())
	    	{
	    		case dmmmyy:
	    			datePresentation = "d-MMM-yy";
	    			break;
	    		case mdyy:
	    			datePresentation = "M/d/yy";
	    			break;
	    		case mdyyhmm:
	    			datePresentation = "M/d/yy H:mm";
	    			break;
	    		case ddmmyyyy:
	    			datePresentation = "dd-MM-yyyy";
	    			break;
	    		case ddmmyyyyhhmm:
    				datePresentation = "dd-MM-yyyy HH:mm";
    				break;
	    		case mmddyyyy:
	    			datePresentation = "MM/dd/yyyy";
    				break;
	    		case mmddyyyyhhmm:
	    			datePresentation = "MM/dd/yyyy HH:mm";
    				break;
	    		case custom:
	    			datePresentation = template.getCustomeDateFormat();
	    	}
    	}
		return datePresentation;
	}

	/**
	 * Sanitizes string values to prevent formula injection attacks in Excel and CSV exports.
	 * If a string starts with characters that Excel/CSV applications interpret as formulas
	 * (=, +, -, @), prepends a single quote to force treatment as literal text.
	 *
	 * Sanitization is ONLY performed when MxTemplate.SanitizeFormulas is explicitly set to true.
	 * If the setting is false or null, no sanitization is performed.
	 *
	 * @param value The string value to sanitize
	 * @return Sanitized string safe for Excel/CSV export, or original value if sanitization is not enabled
	 */
	protected String sanitizeFormulaInjection(String value)
	{
		if (value == null || value.isEmpty())
		{
			return value;
		}

		char firstChar = value.charAt(0);
		if (firstChar == '=' || firstChar == '+' || firstChar == '-' || firstChar == '@')
		{
			return "'" + value;
		}

		return value;
	}
}
