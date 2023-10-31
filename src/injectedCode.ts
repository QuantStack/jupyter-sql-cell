/**
 * The default Python function injected in kernel.
 */
export const PYTHON_CODE = `
def _sql_transfer_data(data, variable='sql_result'):
    import json
    try:
        import pandas
        PANDAS_AVAILABLE = True
    except ModuleNotFoundError:
        PANDAS_AVAILABLE = False

    result = json.loads(data)
    if PANDAS_AVAILABLE:
      result = pandas.DataFrame.from_records(result)

    globals()[variable] = result

`;
