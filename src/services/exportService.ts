import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import apiService from './api';

export interface ExportOptions {
  formato: 'pdf' | 'excel';
  filtro: 'completo' | 'ultimo_saldo_cero' | 'fechas';
  fechaDesde?: string;
  fechaHasta?: string;
}

class ExportService {
  private empresaConfig = {
    razon_social: 'Feraben SRL',
    rut: '020522780010',
    telefono: '097998999',
    email: 'ferabensrl@gmail.com',
    web: 'mareuy.com',
    direccion: 'Montevideo, Uruguay'
  };

  async exportarEstadoCuenta(
    clienteId: number,
    formato: 'pdf' | 'excel',
    filtro: 'completo' | 'ultimo_saldo_cero' | 'fechas',
    fechaDesde?: string,
    fechaHasta?: string
  ): Promise<void> {
    try {
      // Obtener datos del backend
      const response = await fetch(`http://localhost:5000/api/clientes/${clienteId}/exportar-estado-cuenta`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          formato,
          filtro,
          fechaDesde,
          fechaHasta
        }),
      });

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const { datos } = await response.json();

      if (formato === 'pdf') {
        this.exportarPDF(datos);
      } else {
        this.exportarExcel(datos);
      }
    } catch (error) {
      console.error('Error en exportación:', error);
      throw error;
    }
  }

  private exportarPDF(datos: any): void {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    // Configuración de colores MARÉ
    const marrón = '#8F6A50';
    const grisOscuro = '#333333';
    
    // Header de la empresa
    doc.setFontSize(20);
    doc.setTextColor(marrón);
    doc.text('FERABEN SRL', 20, 30);
    
    doc.setFontSize(10);
    doc.setTextColor(grisOscuro);
    doc.text(`RUT: ${this.empresaConfig.rut}`, 20, 40);
    doc.text(`Tel: ${this.empresaConfig.telefono}`, 20, 45);
    doc.text(`Email: ${this.empresaConfig.email}`, 20, 50);
    
    // Título del documento
    doc.setFontSize(16);
    doc.setTextColor(marrón);
    doc.text('ESTADO DE CUENTA', pageWidth / 2, 65, { align: 'center' });
    
    // Información del cliente
    doc.setFontSize(12);
    doc.setTextColor(grisOscuro);
    doc.text('CLIENTE:', 20, 80);
    doc.text(datos.cliente.razon_social, 50, 80);
    
    if (datos.cliente.nombre_fantasia) {
      doc.text('FANTASÍA:', 20, 90);
      doc.text(datos.cliente.nombre_fantasia, 50, 90);
    }
    
    doc.text('RUT:', 20, 100);
    doc.text(datos.cliente.rut, 50, 100);
    
    doc.text('UBICACIÓN:', 20, 110);
    doc.text(`${datos.cliente.ciudad}, ${datos.cliente.departamento}`, 50, 110);
    
    // Saldo actual
    doc.setFontSize(14);
    doc.setTextColor(datos.saldoFinal > 0 ? '#DC2626' : '#059669');
    doc.text('SALDO ACTUAL:', pageWidth - 80, 80);
    doc.text(apiService.formatearMoneda(datos.saldoFinal), pageWidth - 80, 90);
    
    // Fecha de generación
    doc.setFontSize(10);
    doc.setTextColor(grisOscuro);
    doc.text(`Fecha: ${new Date().toLocaleDateString('es-UY')}`, pageWidth - 80, 110);
    
    // Tabla de movimientos
    let yPosition = 130;
    
    // Headers de la tabla
    doc.setFontSize(10);
    doc.setTextColor(marrón);
    doc.text('FECHA', 20, yPosition);
    doc.text('TIPO', 50, yPosition);
    doc.text('DOCUMENTO', 80, yPosition);
    doc.text('IMPORTE', 120, yPosition);
    doc.text('SALDO', 160, yPosition);
    
    // Línea separadora
    doc.setLineWidth(0.5);
    doc.setDrawColor(marrón);
    doc.line(20, yPosition + 2, pageWidth - 20, yPosition + 2);
    
    yPosition += 10;
    
    // Movimientos
    doc.setFontSize(9);
    doc.setTextColor(grisOscuro);
    
    datos.movimientos.forEach((mov: any, index: number) => {
      if (yPosition > pageHeight - 30) {
        doc.addPage();
        yPosition = 30;
      }
      
      doc.text(apiService.formatearFecha(mov.fecha), 20, yPosition);
      doc.text(mov.tipo_movimiento, 50, yPosition);
      doc.text(mov.documento || '-', 80, yPosition);
      
      // Importe con color
      doc.setTextColor(mov.importe > 0 ? '#2563EB' : '#059669');
      doc.text(apiService.formatearMoneda(mov.importe), 120, yPosition);
      
      // Saldo con color
      doc.setTextColor(mov.saldo_acumulado > 0 ? '#DC2626' : '#059669');
      doc.text(apiService.formatearMoneda(mov.saldo_acumulado), 160, yPosition);
      
      doc.setTextColor(grisOscuro);
      yPosition += 8;
    });
    
    // Footer
    doc.setFontSize(8);
    doc.setTextColor('#666666');
    doc.text('Generado por Feraben CRM', pageWidth / 2, pageHeight - 10, { align: 'center' });
    
    // Descargar
    const fileName = `estado_cuenta_${datos.cliente.razon_social.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
  }

  private exportarExcel(datos: any): void {
    const wb = XLSX.utils.book_new();
    
    // Hoja 1: Información del Cliente
    const clienteData = [
      ['FERABEN SRL - ESTADO DE CUENTA'],
      [''],
      ['Información del Cliente:'],
      ['Razón Social:', datos.cliente.razon_social],
      ['RUT:', datos.cliente.rut],
      ['Nombre Fantasía:', datos.cliente.nombre_fantasia || ''],
      ['Ciudad:', datos.cliente.ciudad],
      ['Departamento:', datos.cliente.departamento],
      ['Email:', datos.cliente.email || ''],
      ['Vendedor:', datos.cliente.vendedor_nombre],
      [''],
      ['Resumen:'],
      ['Saldo Actual:', datos.saldoFinal],
      ['Total Movimientos:', datos.movimientos.length],
      ['Fecha Generación:', new Date().toLocaleDateString('es-UY')],
    ];
    
    const wsCliente = XLSX.utils.aoa_to_sheet(clienteData);
    XLSX.utils.book_append_sheet(wb, wsCliente, 'Cliente');
    
    // Hoja 2: Movimientos
    const movimientosData = [
      ['Fecha', 'Tipo', 'Documento', 'Importe', 'Saldo Acumulado', 'Comentario']
    ];
    
    datos.movimientos.forEach((mov: any) => {
      movimientosData.push([
        apiService.formatearFecha(mov.fecha),
        mov.tipo_movimiento,
        mov.documento || '',
        mov.importe,
        mov.saldo_acumulado,
        mov.comentario || ''
      ]);
    });
    
    const wsMovimientos = XLSX.utils.aoa_to_sheet(movimientosData);
    XLSX.utils.book_append_sheet(wb, wsMovimientos, 'Movimientos');
    
    // Hoja 3: Resumen por Tipo
    const resumenTipos = datos.movimientos.reduce((acc: any, mov: any) => {
      if (!acc[mov.tipo_movimiento]) {
        acc[mov.tipo_movimiento] = { cantidad: 0, total: 0 };
      }
      acc[mov.tipo_movimiento].cantidad += 1;
      acc[mov.tipo_movimiento].total += mov.importe;
      return acc;
    }, {});
    
    const resumenData = [
      ['Resumen por Tipo de Movimiento'],
      [''],
      ['Tipo', 'Cantidad', 'Total']
    ];
    
    Object.entries(resumenTipos).forEach(([tipo, datos]: [string, any]) => {
      resumenData.push([tipo, datos.cantidad, datos.total]);
    });
    
    const wsResumen = XLSX.utils.aoa_to_sheet(resumenData);
    XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen');
    
    // Descargar
    const fileName = `estado_cuenta_${datos.cliente.razon_social.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
  }
}

const exportService = new ExportService();
export default exportService;