// Piloto Pão e Arte — carteira completa (45 lojas), preços reais e book com
// todas as fotos do dia 07/10/2026. Idempotente.
migrate(
  (app) => {
    const storesCol = app.findCollectionByNameOrId('stores')
    const brandsCol = app.findCollectionByNameOrId('brands')
    const skusCol = app.findCollectionByNameOrId('skus')
    const booksCol = app.findCollectionByNameOrId('books')
    const bookPhotosCol = app.findCollectionByNameOrId('book_photos')

    // ---- 1. Lojas da carteira ----
    const lojaIds = {}
    const lojas = [
      ['085', 'FORT ATACADISTA JARAGUÁ DO SUL', 'RUA MAX WILHELM, 594', 'FORT ATACADISTA'],
      ['115', 'FORT ATACADISTA BALNEARIO CAMBORIU', 'RUA TOCANTINS', 'FORT ATACADISTA'],
      ['130', 'FORT ATACADISTA PALHOÇA', 'RUA JERUSALÈM', 'FORT ATACADISTA'],
      ['135', 'FORT ATACADISTA BRUSQUE', 'AVENIDA BEPE ROZA, 3700', 'FORT ATACADISTA'],
      ['145', 'FORT ATACADISTA CAMPECHE', 'RODOVIA FRANCISCO MAGNO VIEIRA, 405', 'FORT ATACADISTA'],
      ['160', 'FORT ATACADISTA KOBRASOL', 'RUA CASSOL', 'FORT ATACADISTA'],
      ['165', 'FORT ATACADISTA AVENTUREIRO', 'RUA TUIUTI, 4157', 'FORT ATACADISTA'],
      ['185', 'FORT ATACADISTA IÇARA', 'AVENIDA GOVERNADOR CELSO RAMOS', 'FORT ATACADISTA'],
      ['190', 'FORT ATACADISTA PORTO BELO', 'AVENIDA GOVERNADOR CELSO RAMOS', 'FORT ATACADISTA'],
      [
        '195',
        'FORT ATACADISTA BLUMENAU II',
        'RUA DOUTOR PEDRO ZIMMERMANN, 1511',
        'FORT ATACADISTA',
      ],
      [
        '210',
        'FORT ATACADISTA FLORIANÓPOLIS',
        'RODOVIA ARMANDO CALIL BULOS, 5504',
        'FORT ATACADISTA',
      ],
      ['214', 'FORT ATACADISTA CAMBORIU', 'RUA JOSÉ FRANCISCO BERNARDES, 490', 'FORT ATACADISTA'],
      ['220', 'FORT ATACADISTA TUBARÃO', 'RUA DEPUTADO OLICES PEDRO DE CALDAS', 'FORT ATACADISTA'],
      [
        '225',
        'FORT ATACADISTA CORDEIROS',
        'RUA DOUTOR REINALDO SCHMITHAUSEN, 1249',
        'FORT ATACADISTA',
      ],
      ['235', 'FORT ATACADISTA CRICIÚMA', 'AVENIDA CENTENÁRIO, 1151', 'FORT ATACADISTA'],
      ['240', 'FORT ATACADISTA CHAPECÓ', 'AVENIDA SÃO PEDRO, 1968', 'FORT ATACADISTA'],
      ['250', 'FORT ATACADISTA FLORESTA', 'RUA SANTA CATARINA, 3086', 'FORT ATACADISTA'],
      ['255', 'FORT ATACADISTA RIO DO SUL', 'Rodovia BR-470, 131', 'FORT ATACADISTA'],
      ['260', 'FORT ATACADISTA LAGES', 'AVENIDA PAPA JOÃO XXIII, 295', 'FORT ATACADISTA'],
      ['270', 'FORT ATACADISTA INDAIAL', 'RUA AUGUSTO HASSE', 'FORT ATACADISTA'],
      ['290', 'FORT ATACADISTA BIGUAÇU', 'BIGUAÇU - SC', 'FORT ATACADISTA'],
      ['295', 'FORT ATACADISTA BALNEÁRIO CAMBORIU II', 'AVENIDA MARGINAL LESTE', 'FORT ATACADISTA'],
      ['305', 'FORT ATACADISTA JOINVILLE', 'JOINVILLE - SC', 'FORT ATACADISTA'],
      ['306', 'FORT ATACADISTA SÃO JOSÉ', 'RUA SEBASTIÃO FURTADO PEREIRA', 'FORT ATACADISTA'],
      ['310', 'FORT ATACADISTA ITAJAI', 'AVENIDA CORONEL MARCOS KONDER, 228', 'FORT ATACADISTA'],
      ['325', 'FORT ATACADISTA ITAJAI SÃO JOÃO', 'RUA INDAIAL, 1370C', 'FORT ATACADISTA'],
      ['335', 'FORT ATACADISTA BARRA VELHA', 'RODOVIA GOVERNADOR MÁRIO COVAS', 'FORT ATACADISTA'],
      ['365', 'FORT ATACADISTA SÃO JOSÉ', 'RODOVIA BR-101', 'FORT ATACADISTA'],
      ['375', 'FORT ATACADISTA NAVEGANTES', 'RUA VEREADOR NEREU LIBERATO NUNES', 'FORT ATACADISTA'],
      [
        '379',
        'FORT ATACADISTA FLORIANÓPOLIS JARDIM ATLÂNTICO',
        'RUA ELESBÃO PINTO DA LUZ',
        'FORT ATACADISTA',
      ],
      ['385', 'FORT ATACADISTA SÃO BENTO DO SUL', 'RUA JORGE ZIPPERER', 'FORT ATACADISTA'],
      [
        '395',
        'FORT ATACADISTA SÃO FRANCISCO DO SUL',
        'RUA BINOT PAULMIER DE GONNEVILLE',
        'FORT ATACADISTA',
      ],
      [
        '400',
        'FORT ATACADISTA SÃO BENTO OXFORD',
        'Acesso Deputado Genésio Tureck - Acesso Oeste 992',
        'FORT ATACADISTA',
      ],
      [
        '405',
        'FORT ATACADISTA JOINVILLE COSTA E SILVA',
        'RUA ALMIRANTE JACEGUAY',
        'FORT ATACADISTA',
      ],
      [
        '410',
        'FORT ATACADISTA RIO TAVARES',
        'RODOVIA DOUTOR ANTÔNIO LUIZ MOURA GONZAGA',
        'FORT ATACADISTA',
      ],
      ['420', 'FORT ATACADISTA PENHA', 'RODOVIA BETO CARRERO WORLD', 'FORT ATACADISTA'],
      ['425', 'FORT ATACADISTA DOM BOSCO', 'RUA JOSÉ DARCY DA SILVA', 'FORT ATACADISTA'],
      ['462', 'FORT ATACADISTA PALHOÇA', 'RUA AMARO FERREIRA DE MACEDO', 'FORT ATACADISTA'],
      ['480', 'FORT ATACADISTA BLUMENAU', 'VIA EXPRESSA PAUL FRITZ KUEHNRICH', 'FORT ATACADISTA'],
      ['485', 'FORT ATACADISTA ARARANGUÁ', 'RODOVIA GOVERNADOR MÁRIO COVAS', 'FORT ATACADISTA'],
      ['810', 'FORT ATACADISTA FLORIANÓPOLIS', 'RODOVIA JOSÉ CARLOS DAUX', 'FORT ATACADISTA'],
      ['825', 'FORT ATACADISTA ITAJAÍ', 'Avenida Governador Adolfo Konder, 700', 'FORT ATACADISTA'],
      ['905', 'FORT ATACADISTA JOINVILLE', 'JOINVILLE - SC', 'FORT ATACADISTA'],
      ['944', 'FORT ATACADISTA CHAPECÓ II', 'Rua Pará - D', 'FORT ATACADISTA'],
      ['960', 'FORT ATACADISTA LAGES', 'LAGES - SC', 'FORT ATACADISTA'],
    ]
    for (const [num, nome, addr, rede] of lojas) {
      let rec
      try {
        rec = app.findFirstRecordByData('stores', 'number', num)
      } catch (_) {
        rec = new Record(storesCol)
        rec.set('number', num)
        rec.set('name', nome)
        rec.set('address', addr)
        rec.set('network', rede)
        rec.set('region', 'Sul')
        app.save(rec)
      }
      lojaIds[num] = rec.id
    }

    // ---- 2. Marca Pão e Arte: vincula carteira ----
    let peaBrand
    try {
      peaBrand = app.findFirstRecordByData('brands', 'name', 'Pão e Arte')
    } catch (_) {
      return
    }
    peaBrand.set(
      'stores',
      Object.keys(lojaIds).map((n) => lojaIds[n]),
    )
    app.save(peaBrand)

    // ---- 3. Preços reais dos SKUs ----
    try {
      const top = app.findFirstRecordByData('skus', 'code', 'SKU-PEA-001')
      top.set('normal_price', 7.98)
      top.set('promo_price', 7.48)
      app.save(top)
    } catch (_) {}
    try {
      const fr = app.findFirstRecordByData('skus', 'code', 'SKU-PEA-002')
      fr.set('normal_price', 27.98)
      app.save(fr)
    } catch (_) {}

    // ---- 3b. Tabela de preços (FORT ATACADISTA) ----
    try {
      const ptCol = app.findCollectionByNameOrId('price_tables')
      const top = app.findFirstRecordByData('skus', 'code', 'SKU-PEA-001')
      const fr = app.findFirstRecordByData('skus', 'code', 'SKU-PEA-002')
      const upsert = (sku, preco) => {
        let rec = null
        try {
          rec = app.findFirstRecordByFilter('price_tables', 'sku = {:s} && rede = {:r}', {
            s: sku.id,
            r: 'FORT ATACADISTA',
          })
        } catch (_) {}
        if (!rec) {
          rec = new Record(ptCol)
          rec.set('brand', peaBrand.id)
          rec.set('sku', sku.id)
          rec.set('rede', 'FORT ATACADISTA')
        }
        rec.set('preco', preco)
        app.save(rec)
      }
      upsert(top, 7.98)
      upsert(fr, 27.98)
    } catch (_) {}

    // ---- 4. Book do dia com todas as fotos ----
    // Apaga piloto anterior para reconstruir completo
    try {
      app.delete(app.findFirstRecordByData('books', 'title', 'Pão e Arte — Piloto — 07/10/2026'))
    } catch (_) {}

    let analystId = ''
    try {
      const us = app.findRecordsByFilter(
        '_pb_users_auth_',
        "role = 'analista_books'",
        'created',
        1,
        0,
      )
      if (us.length) analystId = us[0].id
    } catch (_) {}

    const fotos = [
      {
        i: '565368',
        n: '480',
        t: 'Antes',
        p: 'https://diretoria.tradepro.com.br/visualizar-foto?id=yc2qVw1HqYlb3F53blkSwQxazyk3tal_cweaC_HpZYz1Kw',
      },
      {
        i: '565398',
        n: '325',
        t: 'Antes',
        p: 'https://diretoria.tradepro.com.br/visualizar-foto?id=FcOdQFqLWVB5olpZi-cJbP2RdVG_YeTLdJsGSyjI4Zi1sQ',
      },
      {
        i: '565411',
        n: '480',
        t: 'Depois',
        p: 'https://diretoria.tradepro.com.br/visualizar-foto?id=wsyC7GHnaVYTVXZqyPS3Gm3bbBnnC4hrp_S_fBd04DfpTw',
      },
      {
        i: '565516',
        n: '325',
        t: 'Depois',
        p: 'https://diretoria.tradepro.com.br/visualizar-foto?id=3f4o9LKkFY3xJmk6yUEm8JVAyhK0ZCKfmPjlWg7BE5nkpQ',
      },
      {
        i: '567516',
        n: '250',
        t: 'Antes',
        p: 'https://diretoria.tradepro.com.br/visualizar-foto?id=Z2Q8y4oy_XgwPYWtQCwx9NicxMApX7DvfkoHfTK3mSlxHg',
      },
      {
        i: '565560',
        n: '220',
        t: 'Antes',
        p: 'https://diretoria.tradepro.com.br/visualizar-foto?id=gnm69NYGka7p7B4rCqA33EuQ5ECB5gRzeKOxtV1MQhoKxg',
      },
      {
        i: '565587',
        n: '220',
        t: 'Depois',
        p: 'https://diretoria.tradepro.com.br/visualizar-foto?id=WuePuDRSesl4F2SwXgYbisdSCINUYS2GjobgzmP2vxEcWw',
      },
      {
        i: '565608',
        n: '220',
        t: 'Depois',
        p: 'https://diretoria.tradepro.com.br/visualizar-foto?id=QdY47aRJvz_WNdWg2yS2x-SUkTk-tFUb2hG3dEIxzKXj4Q',
      },
      {
        i: '565621',
        n: '240',
        t: 'Antes',
        p: 'https://diretoria.tradepro.com.br/visualizar-foto?id=soG4S1ChSXDhuf5o6gJ7uoTORjWdu-bmagW3bzJlwT0hvw',
      },
      {
        i: '565682',
        n: '810',
        t: 'Antes',
        p: 'https://diretoria.tradepro.com.br/visualizar-foto?id=jL3rC4-lZeKjwTeXxEDSWzyF0WJSElK2oDmsqGgEu1M2mA',
      },
      {
        i: '565683',
        n: '810',
        t: 'Depois',
        p: 'https://diretoria.tradepro.com.br/visualizar-foto?id=yPA9HisveYj7BpDc4VAHfHCVXDeJdBt50kCd-zPco2_cVw',
      },
      {
        i: '567520',
        n: '250',
        t: 'Depois',
        p: 'https://diretoria.tradepro.com.br/visualizar-foto?id=QRVIcaD_HoU-nZ0oMbGA4QF1LvE-4nkL76b5C1LkUGuQLA',
      },
      {
        i: '565729',
        n: '365',
        t: 'Antes',
        p: 'https://diretoria.tradepro.com.br/visualizar-foto?id=lK5G5oeDkBIaSKM-dDeYopmoBPhmePuJGJQ8h6UsP6Znig',
      },
      {
        i: '565787',
        n: '944',
        t: 'Antes',
        p: 'https://diretoria.tradepro.com.br/visualizar-foto?id=707p5sSZ6T15RUCXtC4YWZB5aCbzqZcwlQK5wSmJZNsnFw',
      },
      {
        i: '565788',
        n: '944',
        t: 'Depois',
        p: 'https://diretoria.tradepro.com.br/visualizar-foto?id=1-WphuTVhyp3Z59Njk3O-7UPD259VeNBQxVbut5Gb3DvNQ',
      },
      {
        i: '565815',
        n: '462',
        t: 'Antes',
        p: 'https://diretoria.tradepro.com.br/visualizar-foto?id=SFvflA5uu6b5HIypQ4-X5N2m8yAx2fVqsJWtsOwmJ39xIA',
      },
      {
        i: '565805',
        n: '400',
        t: 'Antes',
        p: 'https://diretoria.tradepro.com.br/visualizar-foto?id=BnCuOa2391ZDy_EbhcJsTQrQRQbZeWiXc6PGqT1rDPK6oQ',
      },
      {
        i: '565859',
        n: '306',
        t: 'Antes',
        p: 'https://diretoria.tradepro.com.br/visualizar-foto?id=jcAK5fjOvR6BkET_z1AbU9izZvVsiOeIKo-_OZxQJmyCEw',
      },
      {
        i: '565860',
        n: '306',
        t: 'Depois',
        p: 'https://diretoria.tradepro.com.br/visualizar-foto?id=z2dScLMPEurDDwlQnVK1cztCXgbSm4sOnvlBFOWV9K9UPg',
      },
      {
        i: '565865',
        n: '240',
        t: 'Depois',
        p: 'https://diretoria.tradepro.com.br/visualizar-foto?id=Z4lD1AYRIydeQ5bwV5FchCsczAFouw_vU1VJnHRVRZM4dg',
      },
      {
        i: '565875',
        n: '400',
        t: 'Depois',
        p: 'https://diretoria.tradepro.com.br/visualizar-foto?id=vO6w3el-XzIJv3rUyW4xKrPIvXFHWfzwgdBiuuFrYW2o0g',
      },
      {
        i: '565899',
        n: '145',
        t: 'Antes',
        p: 'https://diretoria.tradepro.com.br/visualizar-foto?id=bIjemzn6AzaZ5aE10xg4J-84kdUdcR-MJtCMGUb4Ikv7Sg',
      },
      {
        i: '565900',
        n: '145',
        t: 'Depois',
        p: 'https://diretoria.tradepro.com.br/visualizar-foto?id=e-vn365JyAPpO48WVn59Qs-vosVFjqazBO-d4dT4PEliag',
      },
      {
        i: '565941',
        n: '195',
        t: 'Antes',
        p: 'https://diretoria.tradepro.com.br/visualizar-foto?id=-oFD0F5s916AvQ5jCWdMKQgllUuMHHDc0WE6K--tTT9Xkw',
      },
      {
        i: '566014',
        n: '160',
        t: 'Antes',
        p: 'https://diretoria.tradepro.com.br/visualizar-foto?id=tQZy6Ow_XELjanbL48L4G2VKBQ-gyA7L1HGId_KX93PSRA',
      },
      {
        i: '566040',
        n: '405',
        t: 'Antes',
        p: 'https://diretoria.tradepro.com.br/visualizar-foto?id=Zyjw7HObz8l4onWYi9oUO80T95qnjlL2dxVnrQDZDLUzZA',
      },
      {
        i: '566026',
        n: '485',
        t: 'Antes',
        p: 'https://diretoria.tradepro.com.br/visualizar-foto?id=BIVpNYIJPwJx-5R2SOuJr3Galt6950_wnK6c4EJsETLjOw',
      },
      {
        i: '566043',
        n: '255',
        t: 'Antes',
        p: 'https://diretoria.tradepro.com.br/visualizar-foto?id=UO57U-GZdFYz9KuoqUJ9IbuSDZcTRB-rnu7GqlM087DIOQ',
      },
      {
        i: '566044',
        n: '255',
        t: 'Depois',
        p: 'https://diretoria.tradepro.com.br/visualizar-foto?id=EZLEpIAL5tiLPAglPbWiB7tZZV6v6PSDKAj7FB88jA2BWA',
      },
      {
        i: '566062',
        n: '485',
        t: 'Depois',
        p: 'https://diretoria.tradepro.com.br/visualizar-foto?id=v9gWsWBQ-rlhLdtGvQM984r6AOw84QymvhjqSJ9To8uA6Q',
      },
      {
        i: '566063',
        n: '485',
        t: 'Antes',
        p: 'https://diretoria.tradepro.com.br/visualizar-foto?id=F80iIwUpm5TCNjTued-k2PdqeiwsZcb_8agv8J-6pJ3tjw',
      },
      {
        i: '566064',
        n: '485',
        t: 'Depois',
        p: 'https://diretoria.tradepro.com.br/visualizar-foto?id=VbCHQwAsT6yF2_KUupomXvkA8X4cqGEM6KoFc4cnAjK5XQ',
      },
      {
        i: '566082',
        n: '379',
        t: 'Antes',
        p: 'https://diretoria.tradepro.com.br/visualizar-foto?id=qBisxiNzdlC6ZSBb_iI3C3eKVIBGi4sCCwQ8HaoDsvA6uQ',
      },
      {
        i: '566083',
        n: '379',
        t: 'Depois',
        p: 'https://diretoria.tradepro.com.br/visualizar-foto?id=tA4t5sPjFHo2SJw6y3l0zehYCAh6XdTV-zVtlenWCt0NxQ',
      },
      {
        i: '566101',
        n: '160',
        t: 'Depois',
        p: 'https://diretoria.tradepro.com.br/visualizar-foto?id=d6_qIIzvq0cjE6da2giiIFBhTw-9iibk9Wq8yPqUBQNynQ',
      },
      {
        i: '566116',
        n: '335',
        t: 'Antes',
        p: 'https://diretoria.tradepro.com.br/visualizar-foto?id=YHvAmiL8lBWbMtqXR5m3y6hIJF5J26ZTsZooaCPIW72cmQ',
      },
      {
        i: '566124',
        n: '385',
        t: 'Antes',
        p: 'https://diretoria.tradepro.com.br/visualizar-foto?id=zW810sIEmmAO_nNNZ_z7pwbiXgpx2qrKCJQO0LA34qk7cg',
      },
      {
        i: '566154',
        n: '085',
        t: 'Antes',
        p: 'https://diretoria.tradepro.com.br/visualizar-foto?id=lnYKvqLH8be-QUjSx3wVWRpyrB7q4Vvc6Bi4aQE0MlL0iA',
      },
      {
        i: '566200',
        n: '335',
        t: 'Depois',
        p: 'https://diretoria.tradepro.com.br/visualizar-foto?id=IiYdmRF6hIoKL4NZDGeiwlbKdwQg9agdPPgHavmQt8A-aA',
      },
      {
        i: '566220',
        n: '130',
        t: 'Antes',
        p: 'https://diretoria.tradepro.com.br/visualizar-foto?id=XwMJBvJSNzdGFrDOeZCLXyIRtilewbUmWyGu2vZh9WdmNA',
      },
      {
        i: '566258',
        n: '395',
        t: 'Antes',
        p: 'https://diretoria.tradepro.com.br/visualizar-foto?id=tDqTytjfhMMJUFboKw3ANUBZRwgJM8B9I8Pe0hNieXL29w',
      },
      {
        i: '566284',
        n: '375',
        t: 'Antes',
        p: 'https://diretoria.tradepro.com.br/visualizar-foto?id=rIhdFZxQuI0a3tC3O5dybM7yRCBvLZBsCs3lmiQCPVSwiQ',
      },
      {
        i: '566285',
        n: '375',
        t: 'Depois',
        p: 'https://diretoria.tradepro.com.br/visualizar-foto?id=EHTjh0s15bwU4fGkL8sQVQ0HUnPWJYhi0GXvNvck6lHSBQ',
      },
      {
        i: '566288',
        n: '135',
        t: 'Antes',
        p: 'https://diretoria.tradepro.com.br/visualizar-foto?id=WY4Qw-LcXbBUZEH-UrDfnLOkL9zU103yiX7wmJkyXoYA5Q',
      },
      {
        i: '566289',
        n: '135',
        t: 'Depois',
        p: 'https://diretoria.tradepro.com.br/visualizar-foto?id=uFPGZ_N4waV2BygBG3vzjt379twfaPsrAXrIaJYljkes0w',
      },
      {
        i: '566293',
        n: '214',
        t: 'Antes',
        p: 'https://diretoria.tradepro.com.br/visualizar-foto?id=efA9DaOQPZQUMNtjHmJl1m9DKgPgbOshRTYG19GVovXCWQ',
      },
      {
        i: '566294',
        n: '214',
        t: 'Depois',
        p: 'https://diretoria.tradepro.com.br/visualizar-foto?id=jaT_pHi186S_B-0y0mMD-B_1501uBxMOjoPfeBkT3q5W3Q',
      },
      {
        i: '566295',
        n: '214',
        t: 'Depois',
        p: 'https://diretoria.tradepro.com.br/visualizar-foto?id=oHwfKCBb94y818dR2LWGoVvkVr8ygnLL_-7_GSIGAiw76Q',
      },
      {
        i: '566573',
        n: '410',
        t: 'Antes',
        p: 'https://diretoria.tradepro.com.br/visualizar-foto?id=clrQe73WzHV4lH4JIY0y2KoB-4QEcQeEK91eun5Ma5SzGA',
      },
      {
        i: '566574',
        n: '410',
        t: 'Depois',
        p: 'https://diretoria.tradepro.com.br/visualizar-foto?id=16YJ9OMNR33zFATalgsGtdERxE-L4tjFOvNZozH5rc6Uyg',
      },
      {
        i: '566575',
        n: '410',
        t: 'Depois',
        p: 'https://diretoria.tradepro.com.br/visualizar-foto?id=EaFdIm4YTTATm6F2KoCa2yOmo4H4zynhB4iwRvTgxHl26Q',
      },
      {
        i: '566331',
        n: '395',
        t: 'Depois',
        p: 'https://diretoria.tradepro.com.br/visualizar-foto?id=RCo5jny8xuBdwG5y5h7UFXRfgBglZBD7hCB3jDJ0IBuKJg',
      },
      {
        i: '566332',
        n: '395',
        t: 'Depois',
        p: 'https://diretoria.tradepro.com.br/visualizar-foto?id=dGJ8cePWz4tIvgX2nyI8B6UkLpJndW2GSTQhxG_kEs4Pwg',
      },
      {
        i: '566481',
        n: '165',
        t: 'Antes',
        p: 'https://diretoria.tradepro.com.br/visualizar-foto?id=uoxaqAkC4U9MyeyInnOqguV5oFAjeSbVIFxg-B2gTrEF_w',
      },
      {
        i: '566537',
        n: '462',
        t: 'Depois',
        p: 'https://diretoria.tradepro.com.br/visualizar-foto?id=fszvkwvR03OpiudvIDCHPZFRyck2kN-IHbQf2oaJ7sBxjw',
      },
      {
        i: '566485',
        n: '085',
        t: 'Depois',
        p: 'https://diretoria.tradepro.com.br/visualizar-foto?id=x2KTVmODwe4uhqTt4FIg7pT79iUFqM4_u8QLBWfzbpDZ2Q',
      },
      {
        i: '566492',
        n: '210',
        t: 'Antes',
        p: 'https://diretoria.tradepro.com.br/visualizar-foto?id=63F5d-eKF6A6C2hs-8EEMuQTH8GVaO4Pmii36hiXqZSYqA',
      },
      {
        i: '566493',
        n: '210',
        t: 'Depois',
        p: 'https://diretoria.tradepro.com.br/visualizar-foto?id=A7asg_3GuUjikEHP8ldnO8vVQ-s8GtdXKhHTqlYykrJQxA',
      },
      {
        i: '566498',
        n: '115',
        t: 'Antes',
        p: 'https://diretoria.tradepro.com.br/visualizar-foto?id=UjoGxtIS-uEabLqt6k_fGEHbMlYB7nqVEYug_Xc4CY3WAw',
      },
      {
        i: '566544',
        n: '295',
        t: 'Antes',
        p: 'https://diretoria.tradepro.com.br/visualizar-foto?id=3ZDK_4MYRGVzLHg-F9MQhQ5_9SztXBGlzGeAYScrBL41Yg',
      },
      {
        i: '566618',
        n: '825',
        t: 'Antes',
        p: 'https://diretoria.tradepro.com.br/visualizar-foto?id=CMeYrMCz4Mx5Kyzn-7IQw58X73bdF-MgRE8JcxT88E3csg',
      },
      {
        i: '566619',
        n: '825',
        t: 'Depois',
        p: 'https://diretoria.tradepro.com.br/visualizar-foto?id=WweDXhHG3f1Hkf9F_H4x5tIcSjFiXIyvw3wTyo9ZvjXbCQ',
      },
      {
        i: '566672',
        n: '310',
        t: 'Antes',
        p: 'https://diretoria.tradepro.com.br/visualizar-foto?id=Y_gNXkkJmAZ2PEmPzonOYutK054DjB4KXCUWcsHSAvCw-w',
      },
      {
        i: '566673',
        n: '310',
        t: 'Depois',
        p: 'https://diretoria.tradepro.com.br/visualizar-foto?id=EG_j2UFrPkEPI6ZJhMXJoKHqClIjjfKwzmY9-RBaTwYlQA',
      },
      {
        i: '566698',
        n: '185',
        t: 'Antes',
        p: 'https://diretoria.tradepro.com.br/visualizar-foto?id=RZrj2__Tu1UtqLdzJ2-dhSxL6QH7AScBrZUoT2FYOuQHmQ',
      },
      {
        i: '566699',
        n: '185',
        t: 'Depois',
        p: 'https://diretoria.tradepro.com.br/visualizar-foto?id=j9091oOb5hUDdGxoH4w2-ps_uKyd_x1Wao4khvTtxYsWsA',
      },
      {
        i: '566724',
        n: '190',
        t: 'Antes',
        p: 'https://diretoria.tradepro.com.br/visualizar-foto?id=W3bv1sUBsT4XjuLdbCPNzzuN11LCx4lcKvyM45Roe41p2A',
      },
      {
        i: '566725',
        n: '190',
        t: 'Depois',
        p: 'https://diretoria.tradepro.com.br/visualizar-foto?id=BGkyA4fW0bBH9S0yJTMKWY9gELXNJRUNv3hUtrCi54jP7A',
      },
      {
        i: '566738',
        n: '825',
        t: 'Depois',
        p: 'https://diretoria.tradepro.com.br/visualizar-foto?id=UT030YUY9OEAvrsp-NCPz37ugUNjTCwMiorYEyfUDerrjA',
      },
      {
        i: '566744',
        n: '270',
        t: 'Antes',
        p: 'https://diretoria.tradepro.com.br/visualizar-foto?id=kLduUK2MUxwtxNWJfqiOe7KT6Eje_QkMt3qLvvNVTGlthQ',
      },
      {
        i: '566777',
        n: '295',
        t: 'Depois',
        p: 'https://diretoria.tradepro.com.br/visualizar-foto?id=el08_9zLvWx3kdUe36yZ3YIm8HEBq-a8_6bVpqn4t4zD_g',
      },
      {
        i: '566770',
        n: '115',
        t: 'Depois',
        p: 'https://diretoria.tradepro.com.br/visualizar-foto?id=caIiE-O-hr56U6vbnM4Pga_HLIEQB2e__n6dUchovapLRg',
      },
      {
        i: '566818',
        n: '115',
        t: 'Depois',
        p: 'https://diretoria.tradepro.com.br/visualizar-foto?id=fZXFZ0tasYiZNfk8En43QftNhJfQbuNTvyElNazYZeOSkw',
      },
      {
        i: '566822',
        n: '365',
        t: 'Depois',
        p: 'https://diretoria.tradepro.com.br/visualizar-foto?id=Vxm5X1hnZexlp8vPNx3rXPk51x46PQ72iOx5QpVR253ZcQ',
      },
      {
        i: '566861',
        n: '235',
        t: 'Antes',
        p: 'https://diretoria.tradepro.com.br/visualizar-foto?id=fgi3vhRf_s9ihMrmrY_8FSrSp-WMG6Mbs06erxtunQcGmg',
      },
      {
        i: '566862',
        n: '235',
        t: 'Depois',
        p: 'https://diretoria.tradepro.com.br/visualizar-foto?id=JJQ4o5LcMNIQfYMpCczR-HracZUqvhkQ5S96VHWCgd8w8A',
      },
      {
        i: '566880',
        n: '165',
        t: 'Depois',
        p: 'https://diretoria.tradepro.com.br/visualizar-foto?id=MWWnUUxXBpqfZIb1zKVp9Yrnh-mKmSyItkGO6NGfE2ANxQ',
      },
      {
        i: '566969',
        n: '270',
        t: 'Depois',
        p: 'https://diretoria.tradepro.com.br/visualizar-foto?id=Vr7jlEpNZil9GqzJalrcOkjfUv_RBSf-qpF-ndZXOV7gDg',
      },
      {
        i: '566977',
        n: '420',
        t: 'Antes',
        p: 'https://diretoria.tradepro.com.br/visualizar-foto?id=7WC5ifRysC-NLEyB3zNNKr2C1m4V7WrwWRnnHzoHZxStEg',
      },
      {
        i: '567013',
        n: '195',
        t: 'Depois',
        p: 'https://diretoria.tradepro.com.br/visualizar-foto?id=2RbzCTidtbzPqp33A72Qw1MlLRCoFiLdKrl1c5gpj03yqQ',
      },
      {
        i: '567043',
        n: '260',
        t: 'Antes',
        p: 'https://diretoria.tradepro.com.br/visualizar-foto?id=Q6qJzVfKs1OWUxiJMWQNDHsxDAUzgDKZ3SK_looy8AGbnw',
      },
      {
        i: '567044',
        n: '260',
        t: 'Depois',
        p: 'https://diretoria.tradepro.com.br/visualizar-foto?id=-k_kQmNh0mVa0UOei6y6nrhRhhJQeWOuMIdJX_bYS3T7GQ',
      },
      {
        i: '567034',
        n: '270',
        t: 'Depois',
        p: 'https://diretoria.tradepro.com.br/visualizar-foto?id=LrswLvCiBBx1qBKblR960AmUpr7vJ6nFR2o1nR4ejIpmTA',
      },
      {
        i: '567050',
        n: '420',
        t: 'Depois',
        p: 'https://diretoria.tradepro.com.br/visualizar-foto?id=DnvCrva5JUTEY1xXDSqZcd-4ngbI79LBVdkDuRlEt2Jwng',
      },
      {
        i: '567069',
        n: '420',
        t: 'Depois',
        p: 'https://diretoria.tradepro.com.br/visualizar-foto?id=DUvb0WN4pxW5LYcGQPkrHDS-jKJSqUnkKO-2Yqas6YL6qg',
      },
      {
        i: '567072',
        n: '420',
        t: 'Depois',
        p: 'https://diretoria.tradepro.com.br/visualizar-foto?id=HmRlIRi86q48af9uXre_SR_OGE3l9uDsviZzj_SDkwlQ7Q',
      },
      {
        i: '567139',
        n: '235',
        t: 'Depois',
        p: 'https://diretoria.tradepro.com.br/visualizar-foto?id=NH3Hn8r8Ti6Loz3aUQ7bF5MVQw9cbmAXCnNfeCsgbhKS0g',
      },
      {
        i: '567178',
        n: '405',
        t: 'Depois',
        p: 'https://diretoria.tradepro.com.br/visualizar-foto?id=ahmqZNJVze0FuqGrSALPLqXAk2qm6C1F7XJ4EV06f3twAQ',
      },
      {
        i: '567293',
        n: '425',
        t: 'Antes',
        p: 'https://diretoria.tradepro.com.br/visualizar-foto?id=EQYI8dE85tvM6h-T0KbLwH2EoLaGpi3C4bhUlYU-Z3iC7Q',
      },
      {
        i: '567294',
        n: '425',
        t: 'Depois',
        p: 'https://diretoria.tradepro.com.br/visualizar-foto?id=sjg6BPweNDW3cY2liFFaCQ-iy2oq5jCtSUimySPmbrwzwg',
      },
      {
        i: '567488',
        n: '130',
        t: 'Depois',
        p: 'https://diretoria.tradepro.com.br/visualizar-foto?id=u2teWuGV4KatbDfz41-Iz3vg3tEetD2Pqnq1rij0OG630Q',
      },
      {
        i: '567596',
        n: '',
        t: 'Antes',
        p: 'https://diretoria.tradepro.com.br/visualizar-foto?id=zHaJNFAOQnoomEGTLuFGz-GUsHnwwaPTuS1Rw8mgMWGapA',
      },
      {
        i: '567597',
        n: '',
        t: 'Depois',
        p: 'https://diretoria.tradepro.com.br/visualizar-foto?id=hzf8WTCgE4CbILjrcF91kHqRD4m5VNvRfmLAzLBa2Bpgug',
      },
      {
        i: '567688',
        n: '',
        t: 'Antes',
        p: 'https://diretoria.tradepro.com.br/visualizar-foto?id=HisdHppYvRZRIhXFtr2XNRo5CxgCi2yXBiggNc7wSB-zDQ',
      },
      {
        i: '567689',
        n: '',
        t: 'Depois',
        p: 'https://diretoria.tradepro.com.br/visualizar-foto?id=HX5erZ-eKlYy3WQHWFgWFGrn05HE6WPjx39LpUO3nASJew',
      },
    ]

    const rec = new Record(booksCol)
    rec.set('title', 'Pão e Arte — Piloto — 07/10/2026')
    rec.set('brand', peaBrand.id)
    rec.set('analyst', analystId)
    rec.set('file_name', 'pao_e_arte_20261007')
    rec.set('file_size', fotos.length * 300000)
    rec.set('audit_date', '2026-10-07')
    rec.set('audit_frequency', 'daily')
    rec.set('total_slides', fotos.length)
    rec.set('total_photos', fotos.length)
    rec.set('identified_stores', 0)
    rec.set('pending_review', 0)
    rec.set('missing_stores', 0)
    rec.set('status', 'pending_review')
    rec.set('analysis_status', 'pending')
    app.save(rec)

    let slide = 1
    for (const f of fotos) {
      const p = new Record(bookPhotosCol)
      p.set('book', rec.id)
      p.set('slide_number', slide++)
      p.set('photo_index', 0)
      if (f.n && lojaIds[f.n]) {
        p.set('identified_store', lojaIds[f.n])
        p.set('identified_store_name', 'Loja ' + f.n)
      }
      p.set('confidence', 0.9)
      p.set('needs_review', false)
      p.set('review_status', 'approved')
      p.set(
        'extracted_text',
        'TradePRO foto ' + f.i + ' | loja ' + (f.n || '—') + ' | ' + f.t + ' | ' + f.p,
      )
      app.save(p)
    }

    // Conta lojas com foto p/ resumo
    const comFoto = new Set(fotos.filter((f) => f.n).map((f) => f.n)).size
    const totalLojas = Object.keys(lojaIds).length
    rec.set('identified_stores', comFoto)
    rec.set('missing_stores', totalLojas - comFoto)
    rec.set('analysis_status', 'completed')
    rec.set(
      'analysis_summary',
      JSON.stringify({
        lojas_carteira: totalLojas,
        lojas_com_foto: comFoto,
        lojas_sem_foto: totalLojas - comFoto,
        total_fotos: fotos.length,
        preco_pdq_top: '7,98 / promo 7,48',
        preco_pao_frances: 27.98,
        notas: 'Carteira completa + fotos do dia. Price check configurado.',
      }),
    )
    app.save(rec)
  },
  (app) => {
    try {
      app.delete(app.findFirstRecordByData('books', 'title', 'Pão e Arte — Piloto — 07/10/2026'))
    } catch (_) {}
  },
)
