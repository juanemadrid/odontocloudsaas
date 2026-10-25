// src/services/clinicalTemplatesService.js
/**
 * Servicio de Plantillas y Asistente Clínico 100% Programado (Sin IA de Pago)
 * Diseñado específicamente para OdontoCloud con estándares clínicos de odontología.
 * Ofrece generación instantánea, $0 costo por consulta, funcionamiento offline
 * y respuestas educadas y profesionales.
 */

// ─── 1. CATÁLOGO DE ESPECIALIDADES Y PROCEDIMIENTOS CLÍNICOS ─────────────────
export const CLINICAL_SPECIALTIES = [
    {
        id: 'operatoria',
        name: 'Operatoria & Estética',
        icon: '🦷',
        color: 'from-blue-500 to-cyan-500',
        badge: 'bg-blue-50 text-blue-700 border-blue-200',
        procedures: [
            {
                id: 'resina_simple',
                name: 'Resina Simple (1 Superficie)',
                cups: '890201',
                anesthesiaDefault: 'Infiltrativa con Lidocaína 2% con epinefrina (1 carpule)',
                defaultSurfaces: ['Oclusal'],
                materials: 'Aislamiento relativo/absoluto, grabado ácido 37%, adhesivo de 5ta generación, resina nanohíbrida por capas, pulido con discos y pasta diamantada',
                postOp: 'Se indican cuidados oclusales, evitar alimentos duros o pigmentantes en las primeras 24 horas.',
                template: (data) => `Bajo anestesia ${data.anesthesia || 'infiltrativa con Lidocaína 2% (1 carpule)'}, se realiza aislamiento del campo operatorio. Se efectúa remoción de tejido cariado y preparación cavitaria conservadora en pieza dental ${data.tooth || '[Pieza]'}${data.surfacesText ? ` superficie ${data.surfacesText}` : ''}. Se aplica grabado ácido fosfórico al 37% por 15 segundos, lavado profuso y secado sin desecar. Se aplica adhesivo y fotopolimerización. Se restaura mediante técnica incremental con resina compuesta fotocurable nanohíbrida. Se realiza control oclusal con papel de articular, ajuste y pulido de alto brillo. ${data.tolerance || 'Paciente tolera el procedimiento de forma satisfactoria sin complicaciones'}. ${data.postOp || 'Se brindan recomendaciones postoperatorias.'}`
            },
            {
                id: 'resina_compuesta',
                name: 'Resina Compuesta (2 o más Superficies)',
                cups: '890202',
                anesthesiaDefault: 'Infiltrativa con Lidocaína 2% con epinefrina (1 carpule)',
                defaultSurfaces: ['Mesio-Oclusal', 'Ocluso-Distal'],
                materials: 'Sistema de matriz seccional, cuña anatómica, adhesivo universal, resina nanohíbrida estratificada',
                postOp: 'Cuidados masticatorios inmediatos, uso estricto de hilo dental interproximal.',
                template: (data) => `Bajo anestesia ${data.anesthesia || 'infiltrativa con Lidocaína al 2% (1 carpule)'}, se realiza aislamiento del campo operatorio y remoción meticulosa de caries interproximal en pieza dental ${data.tooth || '[Pieza]'}${data.surfacesText ? ` en superficies ${data.surfacesText}` : ''}. Se adapta sistema de matriz seccional con cuña interproximal para garantizar un punto de contacto y perfil de emergencia óptimos. Protocolo adhesivo estándar con grabado selectivo y adhesivo fotopolimerizable. Reconstrucción anatómica estratificada con resina compuesta. Acabado, pulido interproximal y ajuste de oclusión en máxima intercuspidación y lateralidades. ${data.tolerance || 'Procedimiento sin complicaciones'}. ${data.postOp || 'Se dan indicaciones de higiene y uso de seda dental.'}`
            },
            {
                id: 'reconstruccion_coronal',
                name: 'Reconstrucción Coronal / Cúspide',
                cups: '890203',
                anesthesiaDefault: 'Infiltrativa con Lidocaína 2% con epinefrina (1 carpule)',
                defaultSurfaces: ['Cúspide / Corona completa'],
                materials: 'Resina de alta densidad / Bulk Fill, acondicionador dentinario',
                postOp: 'Protección de carga pesada, evaluación para incrustación o corona si el remanente lo amerita.',
                template: (data) => `Bajo anestesia ${data.anesthesia || 'infiltrativa con Lidocaína 2%'}, se procede a la remoción de restauraciones defectuosas y tejido comprometido en pieza ${data.tooth || '[Pieza]'}. Se realiza biselado de márgenes cavitarios y protección dentino-pulpar. Reconstrucción anatómica de cúspide con resina de alta resistencia. Comprobación de puntos de contacto y alivio de sobrecargas oclusales. ${data.tolerance || 'Paciente tolera adecuadamente'}. ${data.postOp || 'Se advierte sobre la necesidad de restauración definitiva protésica de acuerdo con la biomecánica dental.'}`
            },
            {
                id: 'ionomero_vidrio',
                name: 'Restauración con Ionómero de Vidrio',
                cups: '890204',
                anesthesiaDefault: 'Sin anestesia o Tópica',
                defaultSurfaces: ['Cervical / Vestibular'],
                materials: 'Ionómero de vidrio tipo II de restauración / protección de barniz',
                postOp: 'Evitar cepillado traumático horizontal, control en cita posterior.',
                template: (data) => `Se realiza acondicionamiento cavitario y remoción de lesión abfractiva/caries en tercio cervical de pieza dental ${data.tooth || '[Pieza]'}${data.surfacesText ? ` superficie ${data.surfacesText}` : ''}. Aplicación de acondicionador de poliacrílico, colocación de ionómero de vidrio de alta densidad autocurable/fotocurable con liberación de flúor. Sellado de superficie con barniz protector. ${data.tolerance || 'Procedimiento bien tolerado y sin dolor'}. ${data.postOp || 'Se indican pautas de higiene con cepillo de cerdas suaves.'}`
            },
            {
                id: 'profilaxis_detartraje',
                name: 'Detartraje Supragingival & Profilaxis',
                cups: '997101',
                anesthesiaDefault: 'Sin anestesia',
                defaultSurfaces: ['Arcada Superior e Inferior'],
                materials: 'Ultrasonido Cavitrón, puntas periodontales, copa de caucho, pasta profiláctica con flúor',
                postOp: 'Posible sensibilidad transitoria leve. Se recomienda pasta desensibilizante y cepillado suave.',
                template: (data) => `Se realiza valoración periodontal inicial evidenciando presencia de cálculo supragingival y placa bacteriana blanda. Se procede a realizar detartraje supragingival minucioso mediante ultrasonido (cavitrón) en arcada superior e inferior, con énfasis en zona anteroinferior y sectores posteriores. Se complementa con profilaxis dental utilizando cepillo rotatorio, copa de caucho y pasta abrasiva con flúor para remoción de manchas extrínsecas. Se finaliza con enjuague antiséptico con clorhexidina al 0.12%. ${data.tolerance || 'Paciente tolera el procedimiento satisfactoriamente'}. ${data.postOp || 'Se refuerza técnica de cepillado de Bass modificada y uso diario de hilo dental.'}`
            }
        ]
    },
    {
        id: 'cirugia',
        name: 'Cirugía Oral & Exodoncia',
        icon: '🔪',
        color: 'from-rose-500 to-red-600',
        badge: 'bg-rose-50 text-rose-700 border-rose-200',
        procedures: [
            {
                id: 'exodoncia_simple',
                name: 'Exodoncia Simple Diente Permanente',
                cups: '230101',
                anesthesiaDefault: 'Troncular / Infiltrativa con Lidocaína 2% con epinefrina (1.5 carpules)',
                defaultSurfaces: ['Órgano dental'],
                materials: 'Sindesmotomo, elevadores rectos, fórceps anatómico, cureta de Lucas, gasa estéril',
                postOp: 'Morder gasa por 45 minutos. Dieta blanda y fría las primeras 24h. No escupir ni usar pitillos. Reposo físico.',
                template: (data) => `Bajo técnica anestésica ${data.anesthesia || 'troncular/infiltrativa con Lidocaína 2% con epinefrina 1:80.000 (1.5 carpules)'}, previa asepsia y antisepsia de la cavidad oral, se realiza sindesmotomía circunferencial y luxación controlada con elevadores rectos en pieza dental ${data.tooth || '[Pieza]'}. Se completa la avulsión de la pieza con fórceps anatómico sin fractura radicular ni daño a tablas óseas. Curetaje cuidadoso del alvéolo, irrigación con suero fisiológico estéril y compresión bidigital de tablas vestibular y lingual/palatina. Se verifica formación de coágulo firme y hemostasia completa mediante gasa estéril a presión. ${data.tolerance || 'Paciente asintomático, procedimiento sin complicaciones'}. ${data.postOp || 'Se entregan indicaciones postquirúrgicas verbales y por escrito. Se prescribe analgésico según evolución.'}`
            },
            {
                id: 'exodoncia_cordal',
                name: 'Exodoncia Quirúrgica Tercer Molar (Cordal)',
                cups: '230102',
                anesthesiaDefault: 'Troncular e Infiltrativa con Lidocaína 2% (2 carpules)',
                defaultSurfaces: ['Tercer Molar'],
                materials: 'Bisturí #15, periostótomo, pieza de mano quirúrgica, fresa Zekrya, sutura seda/vicryl 3-0',
                postOp: 'Reposo absoluto 48h, hielo local intermitente las primeras 24h, calor húmedo a partir de las 48h. Evitar esfuerzos.',
                template: (data) => `Bajo anestesia ${data.anesthesia || 'troncular e infiltrativa con Lidocaína 2% con epinefrina (2 carpules)'}, se realiza incisión festoneada intrasulcular con descarga vestibular y despegamiento de colgajo mucoperióstico a espesor total en zona de tercer molar ${data.tooth || '[Pieza]'}. Se efectúa osteotomía periférica y odontosección con fresa quirúrgica bajo irrigación continua con solución salina estéril. Luxación y avulsión completa de fragmentos coronarios y radiculares. Se realiza curetaje alveolar, lavado exhaustivo del lecho quirúrgico, reposición del colgajo y sutura con seda 3-0 mediante puntos simples sin tensión. Se constata hemostasia adecuada. ${data.tolerance || 'Paciente tolera muy bien el acto quirúrgico'}. ${data.postOp || 'Se formula antibioterapia y analgesia antiinflamatoria. Se agenda cita para retiro de puntos en 8 días.'}`
            },
            {
                id: 'retiro_puntos',
                name: 'Retiro de Puntos de Sutura',
                cups: '890205',
                anesthesiaDefault: 'Sin anestesia',
                defaultSurfaces: ['Zona quirúrgica'],
                materials: 'Tijera de sutura Goldman / Spencer, pinza algodonera, antiséptico bucal',
                postOp: 'Continuar con higiene bucal normal, evitar traumatismos con el cepillo en la zona cicatrizada.',
                template: (data) => `Se realiza evaluación clínica de la zona quirúrgica en región de pieza ${data.tooth || '[Zona tratada]'}, observando tejidos blandos en óptimo proceso de cicatrización, mucosa rosada, sin signos de infección, dehiscencia ni eritema marginal. Previa antisepsia tópica con clorhexidina al 0.12%, se procede al corte y retiro de puntos de sutura de forma atraumática e indolora. ${data.tolerance || 'Procedimiento rápido, paciente sin dolor'}. ${data.postOp || 'Se da el alta quirúrgica y se autoriza retorno a la dieta habitual.'}`
            },
            {
                id: 'drenaje_absceso',
                name: 'Drenaje de Absceso Odontogénico',
                cups: '240101',
                anesthesiaDefault: 'Infiltrativa periférica leve / Tópica',
                defaultSurfaces: ['Espacio submucoso'],
                materials: 'Bisturí #11 o #15, pinza hemostática mosquito, suero estéril, gasa yodofórmica o dren de látex',
                postOp: 'Enjuagues tibios con agua con sal o clorhexidina. Estricto cumplimiento del esquema antibiótico.',
                template: (data) => `Bajo anestesia infiltrativa perilesional cuidadosa (evitando presión intra-absceso), se realiza incisión de descompresión en la zona de mayor fluctuación a nivel de pieza ${data.tooth || '[Pieza]'}. Se efectúa disección roma con pinza hemostática facilitando la evacuación abundante de material purulento y exudado. Irrigación abundante con solución salina fisiológica estéril. Se coloca drenaje de látex fijado con sutura reabsorbible para mantener la vía permeable. ${data.tolerance || 'Inmediato alivio de la tensión y sintomatología dolorosa en el paciente'}. ${data.postOp || 'Se reitera la cobertura antibiótica de amplio espectro, analgesia y cita de control en 48 horas.'}`
            }
        ]
    },
    {
        id: 'endodoncia',
        name: 'Endodoncia & Pulpar',
        icon: '⚡',
        color: 'from-amber-500 to-yellow-600',
        badge: 'bg-amber-50 text-amber-700 border-amber-200',
        procedures: [
            {
                id: 'apertura_pulpectomia',
                name: 'Apertura Cameral & Pulpectomía de Urgencia',
                cups: '230201',
                anesthesiaDefault: 'Troncular o Infiltrativa con Lidocaína 2% (1.5 carpules)',
                defaultSurfaces: ['Cámara Pulpar'],
                materials: 'Aislamiento absoluto con dique de goma, fresa endo-z, limas K #10 y #15, hipoclorito de sodio al 2.5%, cemento provisional Cavit/Cavitrón',
                postOp: 'Evitar masticar alimentos duros del lado tratado. Tomar analgésico según indicación.',
                template: (data) => `Paciente asiste por cuadro de dolor agudo compatible con pulpitis irreversible en pieza dental ${data.tooth || '[Pieza]'}. Bajo anestesia ${data.anesthesia || 'troncular/infiltrativa'} y aislamiento absoluto con dique de goma y grapa, se realiza apertura cameral y desroofing completo. Se localizan conductos radiculares, se realiza extirpación pulpar (pulpectomía) mediante instrumentación inicial con limas finas bajo abundante irrigación con hipoclorito de sodio al 2.5%. Secado de conductos con conos de papel estériles y colocación de torunda de algodón estéril y sellado hermético provisional con cemento temporal. ${data.tolerance || 'Paciente refiere alivio notable del dolor post-procedimiento'}. ${data.postOp || 'Se formula analgésico y se agenda cita para continuación de biomecánica.'}`
            },
            {
                id: 'instrumentacion_biomecanica',
                name: 'Instrumentación Biomecánica & Medicación Intraconducto',
                cups: '230202',
                anesthesiaDefault: 'Infiltrativa con Lidocaína 2% (1 carpule) o Sin anestesia si la pulpa está necrótica',
                defaultSurfaces: ['Conductos radiculares'],
                materials: 'Localizador apical electrónico, sistema rotatorio Niti, hipoclorito de sodio, EDTA 17%, pasta de hidróxido de calcio',
                postOp: 'Sensibilidad a la percusión normal las primeras 48h. Evitar masticación pesada sobre la pieza.',
                template: (data) => `Bajo aislamiento absoluto en pieza dental ${data.tooth || '[Pieza]'}, se retira restauración provisional. Se determina longitud de trabajo de los conductos mediante localizador apical electrónico. Se procede a la instrumentación y conformación biomecánica mecanizada rotatoria con limas de níquel-titanio hasta calibre apical programado. Irrigación dinámica copiosa alternada con hipoclorito de sodio al 2.5% y EDTA al 17% para remoción de barrillo dentinario. Se secan los conductos y se empaca medicación intraconducto con pasta de hidróxido de calcio hidrófilo. Sellado cameral provisional con ionómero/cemento hermético. ${data.tolerance || 'Procedimiento sin incidentes'}. ${data.postOp || 'Cita programada para obturación final.'}`
            },
            {
                id: 'obturacion_endodontica',
                name: 'Obturación Definitiva de Conductos Radiculares',
                cups: '230203',
                anesthesiaDefault: 'Infiltrativa leve o Sin anestesia',
                defaultSurfaces: ['Conductos radiculares'],
                materials: 'Conos de gutapercha estandarizados, cemento sellador endodóntico (resinoso/biocerámico), condensadores térmicos',
                postOp: 'Se programa de inmediato la restauración coronal definitiva para evitar filtración coronal.',
                template: (data) => `Bajo aislamiento absoluto en pieza ${data.tooth || '[Pieza]'}, se retira medicación intraconducto con abundante irrigación sónica/ultrasónica. Se realiza conometría verificando longitud y traba apical óptima. Secado con conos de papel estéril. Se efectúa obturación definitiva tridimensional de conductos radiculares con técnica de condensación combinada empleando conos de gutapercha y cemento sellador endodóntico biocompatible. Corte de penachos a nivel cervical y sellado de la entrada de conductos. Control radiográfico final que evidencia adecuada compactación y selle apical sin sobreextensión. Sellado provisional. ${data.tolerance || 'Excelente tolerancia del paciente'}. ${data.postOp || 'Se remite para rehabilitación definitiva con poste/resina/corona a la mayor brevedad.'}`
            }
        ]
    },
    {
        id: 'ortodoncia',
        name: 'Ortodoncia & Oclusión',
        icon: '📐',
        color: 'from-emerald-500 to-teal-600',
        badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        procedures: [
            {
                id: 'control_ortodoncia',
                name: 'Control Mensual de Ortodoncia',
                cups: '890206',
                anesthesiaDefault: 'Sin anestesia',
                defaultSurfaces: ['Arcada Superior e Inferior'],
                materials: 'Ligaduras elásticas, cadenas elásticas de tracción, arcos de ortodoncia, pinza Mathieu',
                postOp: 'Sensibilidad y presión moderada los primeros 3 a 4 días. Cera de alivio en caso de roce mucoso.',
                template: (data) => `Paciente asiste a control periódico de ortodoncia. Se evalúa estado de higiene oral (índice de placa ${data.hygiene || 'bueno'}). Se revisa integridad de la aparatología fija bimaxilar. Se realiza retiro de ligaduras elastoméricas previas y profilaxis inter-bracket. En arcada superior se mantiene/instala arco ${data.archUpper || '0.016 NiTi'} con ligaduras individuales; en arcada inferior arco ${data.archLower || '0.016 NiTi'}. Se verifica correcto asentamiento en ranura y se cortan extremos distales sin dejar puntas agresivas. ${data.tolerance || 'Paciente cooperador, refiere comodidad'}. ${data.postOp || 'Se entrega cera protectora y se programa próximo control en 4 semanas.'}`
            },
            {
                id: 'cambio_arcos',
                name: 'Cambio de Arcos & Mecánica de Activación',
                cups: '890207',
                anesthesiaDefault: 'Sin anestesia',
                defaultSurfaces: ['Arcada Superior e Inferior'],
                materials: 'Arcos termoactivados / Acero rectangular, elásticos intermaxilares',
                postOp: 'Uso estricto de elásticos intermaxilares 24h al día si fueron indicados.',
                template: (data) => `Se procede a la secuencia de nivelación y alineación ortodóntica. Se realiza cambio de arcos: en arco superior se coloca alambre ${data.archUpper || '0.016 x 0.022 NiTi'} y en arco inferior alambre ${data.archLower || '0.016 x 0.022 Acero'}. Se activa mecánica de cierre de espacios con cadena elástica continua de primera fuerza. Se instruye al paciente en el uso de elásticos intermaxilares según vector programado. ${data.tolerance || 'Procedimiento sin contratiempos'}. ${data.postOp || 'Se reitera evitar alimentos duros o pegajosos para preservar la aparatología.'}`
            },
            {
                id: 'recementado_bracket',
                name: 'Recementado de Bracket Desprendido',
                cups: '890208',
                anesthesiaDefault: 'Sin anestesia',
                defaultSurfaces: ['Pieza afectada'],
                materials: 'Arenador / microarenado de base, grabado ácido 37%, adhesivo ortodóntico Transbond XT',
                postOp: 'Cuidado al masticar, evitar palanquear alimentos con los dientes anteriores.',
                template: (data) => `Paciente refiere desprendimiento accidental de bracket en pieza dental ${data.tooth || '[Pieza]'}. Se realiza remoción minuciosa del adhesivo residual sobre el esmalte dental con fresa de carburo multilaminada a baja velocidad sin daño a la superficie. Acondicionamiento de esmalte con ácido fosfórico al 37%, lavado, secado y aplicación de imprimador. Posicionamiento milimétrico del bracket con resina ortodóntica fotopolimerizable verificando eje longitudinal y altura clínica. Fotocurado y ligadura al arco principal. ${data.tolerance || 'Paciente conforme'}. ${data.postOp || 'Se refuerzan pautas de cuidado dietario.'}`
            }
        ]
    },
    {
        id: 'periodoncia',
        name: 'Periodoncia Avanzada',
        icon: '🩺',
        color: 'from-purple-500 to-indigo-600',
        badge: 'bg-purple-50 text-purple-700 border-purple-200',
        procedures: [
            {
                id: 'raspaje_alisado',
                name: 'Raspaje y Alisado Radicular (RAR)',
                cups: '997301',
                anesthesiaDefault: 'Infiltrativa con Lidocaína 2% (1.5 carpules)',
                defaultSurfaces: ['Cuadrante tratado'],
                materials: 'Curetas Gracey específicas (1/2, 7/8, 11/12, 13/14), ultrasonido subgingival, clorhexidina al 0.12%',
                postOp: 'Enjuague con clorhexidina 0.12% 2 veces al día por 10 días. Cepillado suave en la zona intervenida.',
                template: (data) => `Bajo anestesia ${data.anesthesia || 'infiltrativa con Lidocaína 2% con epinefrina'}, se procede a realizar terapia periodontal de raspaje y alisado radicular (RAR) a campo cerrado en cuadrante correspondiente a nivel de pieza ${data.tooth || '[Cuadrante/Piezas]'}. Se realiza instrumentación subgingival meticulosa con curetas Gracey y ultrasonido para remoción de cálculo subgingival firme, cemento radicular necrótico y desbridamiento del biofilm bacteriano. Irrigación subgingival con clorhexidina al 0.12%. Se constatan superficies radiculares biológicamente compatibles, lisas y duras. ${data.tolerance || 'Excelente respuesta del paciente'}. ${data.postOp || 'Se programa reevaluación con sondaje periodontal a las 6 semanas.'}`
            }
        ]
    },
    {
        id: 'rehabilitacion',
        name: 'Rehabilitación & Prótesis',
        icon: '👑',
        color: 'from-amber-600 to-orange-600',
        badge: 'bg-orange-50 text-orange-700 border-orange-200',
        procedures: [
            {
                id: 'tallado_pilar',
                name: 'Tallado y Preparación de Pilar Protésico',
                cups: '890209',
                anesthesiaDefault: 'Infiltrativa con Lidocaína 2% (1 carpule)',
                defaultSurfaces: ['Muñón / Diente pilar'],
                materials: 'Fresas de diamante de grano grueso y fino, hilo retractor #000 y #00, silicona pesada y fluida, provisional acrílico',
                postOp: 'Si el provisional se desalienta, acudir de inmediato al consultorio para recementarlo.',
                template: (data) => `Bajo anestesia ${data.anesthesia || 'infiltrativa con Lidocaína 2%'}, se realiza tallado protésico sobre muñón en pieza dental ${data.tooth || '[Pieza]'} para restauración fija tipo corona/incrustación. Se define línea de terminación en chamfer subgingival suave y redondeo de ángulos axiales. Se realiza retracción gingival atraumática con hilo retractor y hemostático. Toma de impresión definitiva con silicona de adición (técnica en dos pasos). Confección, adaptación marginal y cementación de provisional de resina acrílica con cemento temporal libre de eugenol. Ajuste oclusal. ${data.tolerance || 'Paciente asintomático'}. ${data.postOp || 'Se envía orden técnica a laboratorio dental para fabricación de estructura.'}`
            },
            {
                id: 'cementacion_definitiva',
                name: 'Cementación Definitiva de Corona / Incrustación',
                cups: '890210',
                anesthesiaDefault: 'Sin anestesia o Infiltrativa leve',
                defaultSurfaces: ['Corona dental'],
                materials: 'Cemento resinoso dual / Ionómero de vidrio tipo I, ácido fluorhídrico/silano si aplica, glicerina de aislamiento',
                postOp: 'No masticar alimentos duros en las siguientes 2 horas. Uso regular de seda dental en troneras.',
                template: (data) => `Se retira restauración provisional en pieza dental ${data.tooth || '[Pieza]'}. Limpieza y arenado superficial del pilar dental con piedra pómez y clorhexidina. Se realiza prueba clínica de la corona/incrustación definitiva verificando ajuste marginal pasivo, puntos de contacto interproximales y estética dental. Acondicionamiento de la superficie interna de la restauración según el material protésico y cementación definitiva con cemento de fijación biocompatible bajo presión constante y control de humedad. Remoción minuciosa de excesos marginales e interproximales. Chequeo de oclusión en máxima intercuspidación y movimientos de lateralidad y protrusión. ${data.tolerance || 'Paciente manifiesta total satisfacción estética y funcional'}. ${data.postOp || 'Se dan indicaciones de mantenimiento y cita de control en 15 días.'}`
            }
        ]
    },
    {
        id: 'urgencias',
        name: 'Urgencias & Diagnóstico',
        icon: '🚨',
        color: 'from-rose-600 to-pink-600',
        badge: 'bg-rose-50 text-rose-700 border-rose-200',
        procedures: [
            {
                id: 'consulta_urgencia',
                name: 'Consulta de Urgencia Odontológica por Dolor',
                cups: '890101',
                anesthesiaDefault: 'Según necesidad',
                defaultSurfaces: ['Evaluación integral'],
                materials: 'Espejo, explorador, sonda periodontal, pruebas de vitalidad pulpar (frío/calor/percusión)',
                postOp: 'Cumplir estrictamente la formulación médica y acudir a su cita programada.',
                template: (data) => `Paciente acude al servicio odontológico manifestando motivo de consulta: dolor dental localizado en región ${data.tooth || '[Zona anatómica]'}. Al examen clínico y pruebas de sensibilidad térmica y percusión vertical/horizontal, se corrobora diagnóstico presuntivo. Se realiza intervención de alivio terapéutico de urgencia y control del foco doloroso. ${data.tolerance || 'Paciente refiere disminución progresiva del cuadro doloroso'}. ${data.postOp || 'Se expide fórmula médica con analgésico / antiinflamatorio y se concerta plan de tratamiento integral.'}`
            }
        ]
    }
];

// ─── 2. FRASES EDUCADAS Y CORTESES DE VOZ PARA EL ASISTENTE ───────────────────
export const POLITE_VOICE_SCRIPTS = {
    greeting: (doctorName = "Doctor") => {
        const clean = doctorName.replace(/^(Dr\.|Dra\.|Dr|Dra)\s+/i, '');
        const title = clean ? `doctor ${clean}` : "doctor";
        return `Buenos días, ${title}. Le asiste Nova, su copiloto clínico. ¿Qué procedimiento registraremos en esta consulta?`;
    },
    procedureSelected: (procName, tooth = "") => {
        const pieceText = tooth ? ` en pieza dental ${tooth}` : "";
        return `Con mucho gusto, doctor. He seleccionado la plantilla para ${procName}${pieceText}. Los parámetros clínicos han sido precargados con éxito.`;
    },
    evolutionGenerated: (tooth = "") => {
        const piece = tooth ? ` para la pieza ${tooth}` : "";
        return `Excelente, doctor. He estructurado la nota de evolución clínica${piece} con lenguaje médico formal y conforme a la normativa. ¿Desea aplicarla al expediente del paciente?`;
    },
    appliedToForm: () => {
        return `Perfecto, doctor. La evolución clínica ha sido insertada en el formulario. Que continúe teniendo una excelente jornada con su paciente.`;
    },
    voiceListeningStarted: () => {
        return `A su completa orden, doctor. El micrófono está activo. Puede dictar con tranquilidad y tomaré nota de cada palabra.`;
    },
    voiceListeningStopped: () => {
        return `Dictado recibido, doctor. He registrado su voz con precisión.`;
    },
    cleared: () => {
        return `Entendido, doctor. He restablecido el asistente.`;
    }
};

// ─── 3. RECONOCEDOR / PARSER LOCAL INTELIGENTE EN JAVASCRIPT (OFFLINE Y GRATIS) ─
/**
 * Parsea el dictado en lenguaje natural del doctor sin usar ninguna IA externa.
 * Extrae automáticamente pieza dental, procedimiento, superficie, anestesia y tolerancia,
 * y ensambla la nota formal de inmediato.
 */
export function parseClinicalDictationLocally(text) {
    if (!text || typeof text !== 'string') return null;
    const clean = text.toLowerCase().trim();

    // 1. Detección de piezas dentales (11 a 48)
    let tooth = '';
    const toothRegex = /\b([1-4][1-8])\b/g;
    const toothMatches = clean.match(toothRegex);
    if (toothMatches && toothMatches.length > 0) {
        tooth = toothMatches[0];
    } else {
        // Detectar por palabras
        if (clean.includes('cordal') || clean.includes('tercer molar') || clean.includes('muela del juicio')) {
            tooth = 'Tercer Molar';
        } else if (clean.includes('central') || clean.includes('incisivo')) {
            tooth = 'Incisivo';
        } else if (clean.includes('canino')) {
            tooth = 'Canino';
        } else if (clean.includes('premolar')) {
            tooth = 'Premolar';
        } else if (clean.includes('molar')) {
            tooth = 'Molar';
        }
    }

    // 2. Detección de superficies
    const surfaces = [];
    if (clean.includes('oclusal') || clean.includes(' o ')) surfaces.push('Oclusal');
    if (clean.includes('mesial') || clean.includes(' m ')) surfaces.push('Mesial');
    if (clean.includes('distal') || clean.includes(' d ')) surfaces.push('Distal');
    if (clean.includes('vestibular') || clean.includes(' v ')) surfaces.push('Vestibular');
    if (clean.includes('palatino') || clean.includes('lingual') || clean.includes(' p ') || clean.includes(' l ')) {
        surfaces.push(clean.includes('palatino') ? 'Palatina' : 'Lingual');
    }

    // 3. Detección de anestesia
    let anesthesia = 'Infiltrativa con Lidocaína 2% con epinefrina (1 carpule)';
    if (clean.includes('troncular')) {
        anesthesia = 'Troncular con Lidocaína 2% con epinefrina';
    } else if (clean.includes('mepivacaina') || clean.includes('mepivacaína') || clean.includes('sin vaso')) {
        anesthesia = 'Infiltrativa con Mepivacaína al 3% sin vasoconstrictor';
    } else if (clean.includes('sin anestesia') || clean.includes('no se aplico anestesia') || clean.includes('no se aplicó anestesia')) {
        anesthesia = 'Sin anestesia por tratarse de procedimiento no invasivo';
    } else if (clean.includes('topica') || clean.includes('tópica')) {
        anesthesia = 'Tópica en spray/gel benzocaína 20%';
    }

    // 4. Detección de tolerancia
    let tolerance = 'Paciente tolera el procedimiento de forma satisfactoria sin complicaciones';
    if (clean.includes('dolió') || clean.includes('dolor') || clean.includes('molestia')) {
        tolerance = 'Paciente refiere leve molestia transitoria durante el procedimiento, cede satisfactoriamente';
    } else if (clean.includes('sangro') || clean.includes('sangrado')) {
        tolerance = 'Procedimiento con hemostasia controlada mediante presión con gasa estéril';
    } else if (clean.includes('ansioso') || clean.includes('miedo')) {
        tolerance = 'Paciente ansioso pero cooperador durante la atención';
    }

    // 5. Emparejamiento con el catálogo clínico
    let matchedSpecialty = CLINICAL_SPECIALTIES[0];
    let matchedProc = matchedSpecialty.procedures[0];

    if (clean.includes('exodoncia') || clean.includes('sacar') || clean.includes('extraccion') || clean.includes('extracción') || clean.includes('cordal') || clean.includes('cirugia') || clean.includes('cirugía')) {
        matchedSpecialty = CLINICAL_SPECIALTIES.find(s => s.id === 'cirugia');
        if (clean.includes('cordal') || clean.includes('quirurgica') || clean.includes('quirúrgica')) {
            matchedProc = matchedSpecialty.procedures.find(p => p.id === 'exodoncia_cordal') || matchedSpecialty.procedures[0];
        } else if (clean.includes('puntos') || clean.includes('sutura')) {
            matchedProc = matchedSpecialty.procedures.find(p => p.id === 'retiro_puntos') || matchedSpecialty.procedures[0];
        } else {
            matchedProc = matchedSpecialty.procedures.find(p => p.id === 'exodoncia_simple') || matchedSpecialty.procedures[0];
        }
    } else if (clean.includes('endodoncia') || clean.includes('conducto') || clean.includes('pulpa') || clean.includes('pulpectomia') || clean.includes('pulpectomía') || clean.includes('apertura')) {
        matchedSpecialty = CLINICAL_SPECIALTIES.find(s => s.id === 'endodoncia');
        if (clean.includes('obturacion') || clean.includes('obturación') || clean.includes('final') || clean.includes('gutapercha')) {
            matchedProc = matchedSpecialty.procedures.find(p => p.id === 'obturacion_endodontica') || matchedSpecialty.procedures[0];
        } else if (clean.includes('apertura') || clean.includes('urgencia')) {
            matchedProc = matchedSpecialty.procedures.find(p => p.id === 'apertura_pulpectomia') || matchedSpecialty.procedures[0];
        } else {
            matchedProc = matchedSpecialty.procedures.find(p => p.id === 'instrumentacion_biomecanica') || matchedSpecialty.procedures[0];
        }
    } else if (clean.includes('ortodoncia') || clean.includes('bracket') || clean.includes('arco') || clean.includes('ligadura') || clean.includes('frenillos')) {
        matchedSpecialty = CLINICAL_SPECIALTIES.find(s => s.id === 'ortodoncia');
        if (clean.includes('cambio de arco') || clean.includes('alambre')) {
            matchedProc = matchedSpecialty.procedures.find(p => p.id === 'cambio_arcos') || matchedSpecialty.procedures[0];
        } else if (clean.includes('pegar') || clean.includes('recementar') || clean.includes('despegado')) {
            matchedProc = matchedSpecialty.procedures.find(p => p.id === 'recementado_bracket') || matchedSpecialty.procedures[0];
        } else {
            matchedProc = matchedSpecialty.procedures.find(p => p.id === 'control_ortodoncia') || matchedSpecialty.procedures[0];
        }
    } else if (clean.includes('limpieza') || clean.includes('profilaxis') || clean.includes('detartraje') || clean.includes('sarro') || clean.includes('calculo') || clean.includes('cavitron')) {
        matchedSpecialty = CLINICAL_SPECIALTIES.find(s => s.id === 'operatoria');
        matchedProc = matchedSpecialty.procedures.find(p => p.id === 'profilaxis_detartraje') || matchedSpecialty.procedures[0];
    } else if (clean.includes('corona') || clean.includes('pilar') || clean.includes('talla') || clean.includes('tallado') || clean.includes('incrustacion') || clean.includes('incrustación') || clean.includes('impresion') || clean.includes('impresión')) {
        matchedSpecialty = CLINICAL_SPECIALTIES.find(s => s.id === 'rehabilitacion');
        if (clean.includes('cementar') || clean.includes('definitiva') || clean.includes('pegar corona')) {
            matchedProc = matchedSpecialty.procedures.find(p => p.id === 'cementacion_definitiva') || matchedSpecialty.procedures[0];
        } else {
            matchedProc = matchedSpecialty.procedures.find(p => p.id === 'tallado_pilar') || matchedSpecialty.procedures[0];
        }
    } else if (clean.includes('raspaje') || clean.includes('periodoncia') || clean.includes('alisado') || clean.includes('bolsa')) {
        matchedSpecialty = CLINICAL_SPECIALTIES.find(s => s.id === 'periodoncia');
        matchedProc = matchedSpecialty.procedures.find(p => p.id === 'raspaje_alisado') || matchedSpecialty.procedures[0];
    } else {
        // Operatoria por defecto (Resinas)
        matchedSpecialty = CLINICAL_SPECIALTIES.find(s => s.id === 'operatoria');
        if (surfaces.length >= 2 || clean.includes('compuesta')) {
            matchedProc = matchedSpecialty.procedures.find(p => p.id === 'resina_compuesta') || matchedSpecialty.procedures[0];
        } else if (clean.includes('ionomero') || clean.includes('ionómero')) {
            matchedProc = matchedSpecialty.procedures.find(p => p.id === 'ionomero_vidrio') || matchedSpecialty.procedures[0];
        } else {
            matchedProc = matchedSpecialty.procedures.find(p => p.id === 'resina_simple') || matchedSpecialty.procedures[0];
        }
    }

    const surfacesText = surfaces.length > 0 ? surfaces.join('-') : '';

    const generatedText = matchedProc.template({
        tooth: tooth || 'tratada',
        surfacesText,
        anesthesia,
        tolerance,
        materials: matchedProc.materials,
        postOp: matchedProc.postOp
    });

    return {
        specialty: matchedSpecialty,
        procedure: matchedProc,
        tooth: tooth || '',
        surfaces,
        anesthesia,
        tolerance,
        generatedText,
        politeVoiceMsg: POLITE_VOICE_SCRIPTS.evolutionGenerated(tooth || '')
    };
}

// ─── 4. DETECCIÓN DE COMANDOS DE VOZ Y MODO MANOS LIBRES ──────────────────────
export function isSaveOrConfirmCommand(text) {
    if (!text || typeof text !== 'string') return false;
    const clean = text.toLowerCase().trim();
    const savePatterns = [
        /\b(guardar|guarda|guárdala|guardala|guardalo|guárdalo)\b/,
        /\b(finalizar|finaliza|terminar|termina|cerrar)\b/,
        /\b(confirmo|confirmar|confirmado)\b/,
        /\b(s[ií]|correcto|dale|listo|de acuerdo|ok|okay|perfecto|por favor)\b/
    ];
    return savePatterns.some(pattern => pattern.test(clean));
}

export function isCancelCommand(text) {
    if (!text || typeof text !== 'string') return false;
    const clean = text.toLowerCase().trim();
    return /\b(cancelar|cancela|no|no guardes|reiniciar|borrar|detener)\b/.test(clean);
}

export function extractToothFromText(text) {
    if (!text || typeof text !== 'string') return '';
    const clean = text.toLowerCase().trim();
    const toothMatches = clean.match(/\b([1-4][1-8])\b/g);
    if (toothMatches && toothMatches.length > 0) return toothMatches[0];
    if (clean.includes('cordal') || clean.includes('tercer molar') || clean.includes('muela del juicio')) return 'Tercer Molar';
    if (clean.includes('canino')) return 'Canino';
    if (clean.includes('premolar')) return 'Premolar';
    if (clean.includes('molar')) return 'Molar';
    if (clean.includes('incisivo')) return 'Incisivo';
    return '';
}

export function extractAnesthesiaFromText(text) {
    if (!text || typeof text !== 'string') return '';
    const clean = text.toLowerCase().trim();
    if (clean.includes('troncular')) return 'Troncular con Lidocaína 2% con epinefrina (1.5 carpules)';
    if (clean.includes('mepivacaina') || clean.includes('mepivacaína') || clean.includes('sin vaso')) {
        return 'Infiltrativa con Mepivacaína al 3% sin vasoconstrictor';
    }
    if (clean.includes('sin anestesia') || clean.includes('no aplique') || clean.includes('no se aplico') || clean.includes('no se aplicó')) {
        return 'Sin anestesia por tratarse de procedimiento no invasivo';
    }
    if (clean.includes('topica') || clean.includes('tópica')) {
        return 'Tópica en spray / gel benzocaína 20%';
    }
    if (clean.includes('infiltrativa') || clean.includes('lidocaina') || clean.includes('lidocaína') || clean.includes('carpule') || clean.includes('anestesia')) {
        return 'Infiltrativa con Lidocaína 2% con epinefrina (1 carpule)';
    }
    return '';
}

export function extractToleranceFromText(text) {
    if (!text || typeof text !== 'string') return '';
    const clean = text.toLowerCase().trim();
    if (clean.includes('dolió') || clean.includes('dolor') || clean.includes('molestia')) {
        return 'Paciente refiere leve molestia transitoria durante el procedimiento, cede satisfactoriamente';
    }
    if (clean.includes('sangro') || clean.includes('sangrado') || clean.includes('hemorragia')) {
        return 'Procedimiento con hemostasia controlada mediante presión con gasa estéril';
    }
    if (clean.includes('ansioso') || clean.includes('nervioso') || clean.includes('miedo')) {
        return 'Paciente ansioso pero cooperador durante la atención';
    }
    if (clean.includes('bien') || clean.includes('normal') || clean.includes('tranquilo') || clean.includes('sin dolor') || clean.includes('ninguna') || clean.includes('satisfactorio')) {
        return 'Paciente tolera el procedimiento de forma satisfactoria sin complicaciones';
    }
    return '';
}
