import jsPDF from 'jspdf';
import apiService from './api';

interface LiquidacionCompleta {
  id: number;
  vendedor_id: number;
  vendedor_nombre: string;
  periodo_desde: string;
  periodo_hasta: string;
  total_base: number;
  total_comision: number;
  adelantos_otorgados: number;
  dinero_en_mano: number;
  otros_descuentos: number;
  otros_bonos: number;
  total_neto: number;
  metodo_pago: string;
  referencia_pago: string;
  observaciones_liquidacion: string;
  fecha_entrega: string;
  created_at: string;
  porcentaje: number;
  base_calculo: string;
  cantidad_movimientos: number;
  cantidad_clientes: number;
  detalles: any[];
  adelantos_aplicados: any[];
  dinero_aplicado: any[];
}

class ExportLiquidacionService {
  private empresaConfig = {
    razon_social: 'Feraben SRL',
    rut: '020522780010',
    telefono: '097998999',
    email: 'ferabensrl@gmail.com',
    web: 'mareuy.com',
    direccion: 'Montevideo, Uruguay'
  };

  async exportarReciboPDF(liquidacionId: number): Promise<void> {
    try {
      // Obtener datos completos de la liquidación
      const response = await fetch(`http://localhost:5000/api/comisiones/liquidaciones/${liquidacionId}/exportar-pdf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const { datos } = await response.json();
      
      this.generarPDFRecibo(datos.liquidacion, datos.empresa, datos.numero_recibo);
    } catch (error) {
      console.error('Error exportando recibo PDF:', error);
      throw error;
    }
  }

  private generarPDFRecibo(liquidacion: LiquidacionCompleta, empresa: any, numeroRecibo: string): void {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    // Configuración de colores MARÉ
    const marrón = '#8F6A50';
    const grisOscuro = '#333333';
    const azulOscuro = '#1e40af';
    
    let yPos = 25;

    // ===== HEADER DE LA EMPRESA =====
    doc.setFontSize(24);
    doc.setTextColor(marrón);
    doc.text('FERABEN SRL', 20, yPos);
    
    doc.setFontSize(10);
    doc.setTextColor(grisOscuro);
    yPos += 8;
    doc.text(`RUT: ${empresa.rut}`, 20, yPos);
    yPos += 5;
    doc.text(`Tel: ${empresa.telefono} | Email: ${empresa.email}`, 20, yPos);
    yPos += 5;
    doc.text(`${empresa.direccion} | ${empresa.web}`, 20, yPos);

    // Número de recibo (esquina superior derecha)
    doc.setFontSize(12);
    doc.setTextColor(azulOscuro);
    doc.text(`RECIBO Nº ${numeroRecibo}`, pageWidth - 70, 25);
    
    doc.setFontSize(10);
    doc.setTextColor(grisOscuro);
    doc.text(`Fecha: ${new Date().toLocaleDateString('es-UY')}`, pageWidth - 70, 35);

    // ===== TÍTULO DEL DOCUMENTO =====
    yPos += 15;
    doc.setFontSize(18);
    doc.setTextColor(marrón);
    doc.text('LIQUIDACIÓN DE COMISIÓN', pageWidth / 2, yPos, { align: 'center' });

    // ===== INFORMACIÓN DEL VENDEDOR =====
    yPos += 20;
    doc.setFontSize(12);
    doc.setTextColor(azulOscuro);
    doc.text('DATOS DEL VENDEDOR:', 20, yPos);
    
    yPos += 10;
    doc.setFontSize(10);
    doc.setTextColor(grisOscuro);
    doc.text(`Vendedor: ${liquidacion.vendedor_nombre}`, 20, yPos);
    yPos += 5;
    doc.text(`Período: ${apiService.formatearFecha(liquidacion.periodo_desde)} al ${apiService.formatearFecha(liquidacion.periodo_hasta)}`, 20, yPos);
    yPos += 5;
    doc.text(`Base de cálculo: ${liquidacion.porcentaje}% sobre ${liquidacion.base_calculo}`, 20, yPos);

    // ===== RESUMEN DE COMISIÓN =====
    yPos += 15;
    doc.setFontSize(12);
    doc.setTextColor(azulOscuro);
    doc.text('RESUMEN DE COMISIÓN:', 20, yPos);

    yPos += 10;
    doc.setFontSize(10);
    doc.setTextColor(grisOscuro);
    doc.text(`Movimientos procesados: ${liquidacion.cantidad_movimientos}`, 20, yPos);
    yPos += 5;
    doc.text(`Clientes atendidos: ${liquidacion.cantidad_clientes}`, 20, yPos);
    yPos += 5;
    doc.text(`Base comisionable: ${apiService.formatearMoneda(liquidacion.total_base)}`, 20, yPos);

    // Comisión bruta destacada
    yPos += 8;
    doc.setFontSize(12);
    doc.setTextColor(azulOscuro);
    doc.text(`COMISIÓN BRUTA: ${apiService.formatearMoneda(liquidacion.total_comision)}`, 20, yPos);

    // ===== AJUSTES Y DESCUENTOS =====
    yPos += 15;
    doc.setFontSize(12);
    doc.setTextColor(marrón);
    doc.text('AJUSTES Y DESCUENTOS:', 20, yPos);

    // Tabla de ajustes
    yPos += 10;
    doc.setFontSize(10);
    doc.setTextColor(grisOscuro);
    
    // Headers de tabla
    const colX1 = 20, colX2 = 120, colX3 = 160;
    doc.text('CONCEPTO', colX1, yPos);
    doc.text('IMPORTE', colX2, yPos);
    doc.text('DESCRIPCIÓN', colX3, yPos);
    
    // Línea separadora
    yPos += 3;
    doc.setLineWidth(0.5);
    doc.setDrawColor(grisOscuro);
    doc.line(20, yPos, pageWidth - 20, yPos);
    
    yPos += 8;

    // Comisión bruta
    doc.setTextColor('#059669'); // Verde
    doc.text('(+) Comisión bruta', colX1, yPos);
    doc.text(apiService.formatearMoneda(liquidacion.total_comision), colX2, yPos);
    doc.text(`${liquidacion.porcentaje}% sobre ${liquidacion.base_calculo}`, colX3, yPos);
    yPos += 6;

    // Adelantos
    if (liquidacion.adelantos_otorgados > 0) {
      doc.setTextColor('#dc2626'); // Rojo
      doc.text('(-) Adelantos otorgados', colX1, yPos);
      doc.text(apiService.formatearMoneda(liquidacion.adelantos_otorgados), colX2, yPos);
      doc.text(`${liquidacion.adelantos_aplicados?.length || 0} adelanto(s)`, colX3, yPos);
      yPos += 6;
    }

    // Dinero en mano
    if (liquidacion.dinero_en_mano > 0) {
      doc.setTextColor('#dc2626'); // Rojo
      doc.text('(-) Dinero en mano', colX1, yPos);
      doc.text(apiService.formatearMoneda(liquidacion.dinero_en_mano), colX2, yPos);
      doc.text(`${liquidacion.dinero_aplicado?.length || 0} cobro(s)`, colX3, yPos);
      yPos += 6;
    }

    // Otros descuentos
    if (liquidacion.otros_descuentos > 0) {
      doc.setTextColor('#dc2626'); // Rojo
      doc.text('(-) Otros descuentos', colX1, yPos);
      doc.text(apiService.formatearMoneda(liquidacion.otros_descuentos), colX2, yPos);
      doc.text('Descuentos varios', colX3, yPos);
      yPos += 6;
    }

    // Bonos
    if (liquidacion.otros_bonos > 0) {
      doc.setTextColor('#059669'); // Verde
      doc.text('(+) Bonos/Incentivos', colX1, yPos);
      doc.text(apiService.formatearMoneda(liquidacion.otros_bonos), colX2, yPos);
      doc.text('Bonos adicionales', colX3, yPos);
      yPos += 6;
    }

    // Línea separadora antes del total
    yPos += 3;
    doc.setLineWidth(1);
    doc.setDrawColor(marrón);
    doc.line(20, yPos, pageWidth - 20, yPos);

    // ===== TOTAL NETO =====
    yPos += 10;
    doc.setFontSize(16);
    const esPositivo = liquidacion.total_neto >= 0;
    doc.setTextColor(esPositivo ? '#059669' : '#dc2626');
    
    const textoTotal = esPositivo ? 'TOTAL A PAGAR:' : 'SALDO A FAVOR EMPRESA:';
    doc.text(textoTotal, 20, yPos);
    doc.text(apiService.formatearMoneda(Math.abs(liquidacion.total_neto)), pageWidth - 20, yPos, { align: 'right' });

    // ===== INFORMACIÓN DE PAGO =====
    if (esPositivo && liquidacion.total_neto > 0) {
      yPos += 15;
      doc.setFontSize(12);
      doc.setTextColor(azulOscuro);
      doc.text('INFORMACIÓN DE PAGO:', 20, yPos);

      yPos += 10;
      doc.setFontSize(10);
      doc.setTextColor(grisOscuro);
      doc.text(`Método de pago: ${liquidacion.metodo_pago?.toUpperCase() || 'NO ESPECIFICADO'}`, 20, yPos);
      
      if (liquidacion.referencia_pago) {
        yPos += 5;
        doc.text(`Referencia: ${liquidacion.referencia_pago}`, 20, yPos);
      }
      
      if (liquidacion.fecha_entrega) {
        yPos += 5;
        doc.text(`Fecha de entrega: ${apiService.formatearFecha(liquidacion.fecha_entrega)}`, 20, yPos);
      }
    }

    // ===== OBSERVACIONES =====
    if (liquidacion.observaciones_liquidacion) {
      yPos += 15;
      doc.setFontSize(12);
      doc.setTextColor(azulOscuro);
      doc.text('OBSERVACIONES:', 20, yPos);

      yPos += 8;
      doc.setFontSize(9);
      doc.setTextColor(grisOscuro);
      const observaciones = doc.splitTextToSize(liquidacion.observaciones_liquidacion, pageWidth - 40);
      doc.text(observaciones, 20, yPos);
      yPos += observaciones.length * 4;
    }

    // ===== FIRMAS =====
    const firmasY = Math.max(yPos + 30, pageHeight - 60);
    
    doc.setFontSize(10);
    doc.setTextColor(grisOscuro);
    
    // Firma del vendedor
    doc.text('_________________________', 30, firmasY);
    doc.text(`Firma: ${liquidacion.vendedor_nombre}`, 30, firmasY + 6);
    doc.text('Vendedor', 30, firmasY + 12);

    // Firma del administrador
    doc.text('_________________________', pageWidth - 80, firmasY);
    doc.text('Firma: Administración', pageWidth - 80, firmasY + 6);
    doc.text('Feraben SRL', pageWidth - 80, firmasY + 12);

    // ===== FOOTER =====
    doc.setFontSize(8);
    doc.setTextColor('#666666');
    doc.text(`Liquidación generada el ${new Date().toLocaleString('es-UY')}`, pageWidth / 2, pageHeight - 15, { align: 'center' });
    doc.text('Este documento constituye comprobante de liquidación de comisión', pageWidth / 2, pageHeight - 10, { align: 'center' });

    // ===== SEGUNDA PÁGINA CON DETALLE (si hay muchos movimientos) =====
    if (liquidacion.detalles && liquidacion.detalles.length > 0) {
      doc.addPage();
      
      let yDetalle = 25;
      doc.setFontSize(16);
      doc.setTextColor(marrón);
      doc.text('DETALLE DE MOVIMIENTOS COMISIONABLES', pageWidth / 2, yDetalle, { align: 'center' });

      yDetalle += 15;
      doc.setFontSize(10);
      doc.setTextColor(grisOscuro);
      
      // Headers
      doc.text('FECHA', 20, yDetalle);
      doc.text('CLIENTE', 45, yDetalle);
      doc.text('TIPO', 120, yDetalle);
      doc.text('BASE', 145, yDetalle);
      doc.text('COMISIÓN', 170, yDetalle);

      yDetalle += 5;
      doc.setLineWidth(0.5);
      doc.line(20, yDetalle, pageWidth - 20, yDetalle);
      yDetalle += 8;

      // Detalles (máximo 25 movimientos por página)
      liquidacion.detalles.slice(0, 25).forEach((detalle) => {
        if (yDetalle > pageHeight - 30) {
          doc.addPage();
          yDetalle = 25;
        }

        doc.setFontSize(8);
        doc.text(apiService.formatearFecha(detalle.fecha_movimiento), 20, yDetalle);
        doc.text(detalle.cliente_nombre.substring(0, 25), 45, yDetalle);
        doc.text(detalle.tipo_movimiento, 120, yDetalle);
        doc.text(apiService.formatearMoneda(detalle.base_comisionable), 145, yDetalle);
        doc.text(apiService.formatearMoneda(detalle.comision_calculada), 170, yDetalle);
        
        yDetalle += 5;
      });

      if (liquidacion.detalles.length > 25) {
        yDetalle += 5;
        doc.setFontSize(9);
        doc.setTextColor('#666666');
        doc.text(`Mostrando 25 de ${liquidacion.detalles.length} movimientos`, 20, yDetalle);
      }
    }

    // ===== DESCARGAR PDF =====
    const fileName = `Liquidacion_${liquidacion.vendedor_nombre.replace(/\s+/g, '_')}_${liquidacion.id}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
  }
}

export default new ExportLiquidacionService();